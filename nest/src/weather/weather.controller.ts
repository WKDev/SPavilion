import { Controller, Get, Query } from '@nestjs/common';
import { WeatherService } from './weather.service';

@Controller('api/weather')
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  /**
   * 최신 날씨 데이터 조회 (프론트엔드 호환용)
   * GET /api/weather
   */
  @Get()
  async get() {
    const latest = await this.weatherService.getLatest();
    if (!latest) {
      // DB에 데이터가 없으면 직접 fetch 시도
      const fetched = await this.weatherService.fetchAndSaveWeather();
      if (!fetched) {
        return { error: 'No weather data available' };
      }
      return {
        temperature: fetched.temperature,
        humidity: fetched.humidity,
        precipitation: fetched.precipitation,
        windSpeed: fetched.windSpeed,
        baseDate: fetched.baseDate,
        baseTime: fetched.baseTime,
        location: { nx: fetched.nx, ny: fetched.ny },
      };
    }
    return {
      temperature: latest.temperature,
      humidity: latest.humidity,
      precipitation: latest.precipitation,
      windSpeed: latest.windSpeed,
      baseDate: latest.baseDate,
      baseTime: latest.baseTime,
      location: { nx: latest.nx, ny: latest.ny },
    };
  }

  /**
   * 최신 날씨 데이터 조회
   * GET /api/weather/latest
   */
  @Get('latest')
  async getLatest() {
    const latest = await this.weatherService.getLatest();
    if (!latest) {
      return { error: 'No weather data available' };
    }
    return {
      temperature: latest.temperature,
      humidity: latest.humidity,
      precipitation: latest.precipitation,
      windSpeed: latest.windSpeed,
      baseDate: latest.baseDate,
      baseTime: latest.baseTime,
      location: { nx: latest.nx, ny: latest.ny },
      recordedAt: latest.ts,
    };
  }

  /**
   * 날씨 이력 조회
   * GET /api/weather/history?from=2024-01-01&to=2024-01-02
   */
  @Get('history')
  async getHistory(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const toDate = to ? new Date(to) : new Date();

    const history = await this.weatherService.getHistory(fromDate, toDate);
    return history.map((record) => ({
      temperature: record.temperature,
      humidity: record.humidity,
      precipitation: record.precipitation,
      windSpeed: record.windSpeed,
      baseDate: record.baseDate,
      baseTime: record.baseTime,
      location: { nx: record.nx, ny: record.ny },
      recordedAt: record.ts,
    }));
  }

  /**
   * 수동으로 날씨 데이터 수집 트리거
   * GET /api/weather/fetch
   */
  @Get('fetch')
  async triggerFetch() {
    const result = await this.weatherService.fetchAndSaveWeather();
    if (!result) {
      return { success: false, message: 'Failed to fetch weather data' };
    }
    return {
      success: true,
      data: {
        temperature: result.temperature,
        humidity: result.humidity,
        precipitation: result.precipitation,
        windSpeed: result.windSpeed,
        baseDate: result.baseDate,
        baseTime: result.baseTime,
      },
    };
  }
}
