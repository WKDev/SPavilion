import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeatherHistory } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateWeatherDto } from './dto/create-weather.dto';

interface KMAResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body?: {
      dataType: string;
      items: {
        item: Array<{
          baseDate: string;
          baseTime: string;
          category: string;
          nx: number;
          ny: number;
          obsrValue: string;
        }>;
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

interface WeatherData {
  temperature: number | null;
  humidity: number | null;
  precipitation: string | null;
  windSpeed: number | null;
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
}

@Injectable()
export class WeatherService implements OnModuleInit {
  private readonly logger = new Logger(WeatherService.name);
  private readonly KMA_API_URL =
    'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // 서버 시작 시 최초 1회 날씨 데이터 수집
    this.logger.log('Weather service initialized, fetching initial data...');
    await this.fetchAndSaveWeather();
  }

  /**
   * 10분마다 날씨 데이터를 수집하여 DB에 저장
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleCron() {
    this.logger.log('Scheduled weather data collection...');
    await this.fetchAndSaveWeather();
  }

  /**
   * 현재 시간 기준 base_time 계산
   * 초단기실황은 매시 40분 이후 발표되므로, 현재 분이 40분 미만이면 1시간 전 데이터 사용
   */
  private getBaseDateTime(): { baseDate: string; baseTime: string } {
    const now = new Date();

    if (now.getMinutes() < 40) {
      now.setHours(now.getHours() - 1);
    }

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');

    return {
      baseDate: `${year}${month}${day}`,
      baseTime: `${hour}00`,
    };
  }

  /**
   * 강수형태 코드를 문자열로 변환
   */
  private getPrecipitationType(code: string): string {
    const types: Record<string, string> = {
      '0': '없음',
      '1': '비',
      '2': '비/눈',
      '3': '눈',
      '4': '소나기',
      '5': '빗방울',
      '6': '빗방울눈날림',
      '7': '눈날림',
    };
    return types[code] || '알 수 없음';
  }

  /**
   * 기상청 API에서 날씨 데이터를 가져옴
   */
  async fetchWeatherFromKMA(): Promise<WeatherData | null> {
    const serviceKey = this.configService.get<string>('KMA_API_KEY');
    const nx = this.configService.get<string>('KMA_NX') || '60';
    const ny = this.configService.get<string>('KMA_NY') || '127';

    if (!serviceKey) {
      this.logger.warn('KMA_API_KEY is not configured');
      return null;
    }

    const { baseDate, baseTime } = this.getBaseDateTime();

    const params = new URLSearchParams({
      serviceKey: serviceKey,
      numOfRows: '10',
      pageNo: '1',
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx: nx,
      ny: ny,
    });

    try {
      const response = await fetch(`${this.KMA_API_URL}?${params.toString()}`);

      if (!response.ok) {
        this.logger.error(`KMA API request failed: ${response.status}`);
        return null;
      }

      const data: KMAResponse = await response.json();

      if (data.response.header.resultCode !== '00') {
        this.logger.error(`KMA API error: ${data.response.header.resultMsg}`);
        return null;
      }

      if (!data.response.body?.items?.item) {
        this.logger.error('No weather data available from KMA API');
        return null;
      }

      const items = data.response.body.items.item;
      const weatherData: WeatherData = {
        temperature: null,
        humidity: null,
        precipitation: null,
        windSpeed: null,
        baseDate,
        baseTime,
        nx: parseInt(nx),
        ny: parseInt(ny),
      };

      items.forEach((item) => {
        switch (item.category) {
          case 'T1H':
            weatherData.temperature = parseFloat(item.obsrValue);
            break;
          case 'REH':
            weatherData.humidity = parseFloat(item.obsrValue);
            break;
          case 'PTY':
            weatherData.precipitation = this.getPrecipitationType(
              item.obsrValue,
            );
            break;
          case 'WSD':
            weatherData.windSpeed = parseFloat(item.obsrValue);
            break;
        }
      });

      return weatherData;
    } catch (error) {
      this.logger.error('Failed to fetch weather data from KMA', error);
      return null;
    }
  }

  /**
   * 날씨 데이터를 DB에 저장
   */
  async saveWeather(dto: CreateWeatherDto): Promise<WeatherHistory> {
    return this.prisma.weatherHistory.create({
      data: {
        temperature: dto.temperature,
        humidity: dto.humidity,
        precipitation: dto.precipitation,
        windSpeed: dto.windSpeed,
        baseDate: dto.baseDate,
        baseTime: dto.baseTime,
        nx: dto.nx,
        ny: dto.ny,
      },
    });
  }

  /**
   * 기상청 API에서 데이터를 가져와 DB에 저장 (중복 방지)
   */
  async fetchAndSaveWeather(): Promise<WeatherHistory | null> {
    const weatherData = await this.fetchWeatherFromKMA();

    if (!weatherData) {
      return null;
    }

    // 동일한 baseDate, baseTime의 데이터가 이미 있는지 확인 (중복 방지)
    const existing = await this.prisma.weatherHistory.findFirst({
      where: {
        baseDate: weatherData.baseDate,
        baseTime: weatherData.baseTime,
        nx: weatherData.nx,
        ny: weatherData.ny,
      },
    });

    if (existing) {
      this.logger.log(
        `Weather data for ${weatherData.baseDate} ${weatherData.baseTime} already exists, skipping...`,
      );
      return existing;
    }

    const saved = await this.saveWeather({
      temperature: weatherData.temperature ?? undefined,
      humidity: weatherData.humidity ?? undefined,
      precipitation: weatherData.precipitation ?? undefined,
      windSpeed: weatherData.windSpeed ?? undefined,
      baseDate: weatherData.baseDate,
      baseTime: weatherData.baseTime,
      nx: weatherData.nx,
      ny: weatherData.ny,
    });

    this.logger.log(
      `Saved weather data: ${weatherData.temperature}°C, ${weatherData.humidity}% (${weatherData.baseDate} ${weatherData.baseTime})`,
    );

    return saved;
  }

  /**
   * 최근 날씨 데이터 조회
   */
  async getLatest(): Promise<WeatherHistory | null> {
    return this.prisma.weatherHistory.findFirst({
      orderBy: { ts: 'desc' },
    });
  }

  /**
   * 기간별 날씨 이력 조회
   */
  async getHistory(from: Date, to: Date): Promise<WeatherHistory[]> {
    return this.prisma.weatherHistory.findMany({
      where: {
        ts: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { ts: 'asc' },
    });
  }
}
