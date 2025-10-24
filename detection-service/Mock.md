# GStreamer 테스트 패턴 사용
gst_pipeline = (
    "videotestsrc pattern=ball ! "
    "video/x-raw,width=640,height=480,framerate=30/1 ! "
    "videoconvert ! appsink"
)

# detection-service/main.py 수정
def init_camera():
    # Mock 모드일 때 비디오 파일 사용
    if os.getenv('MOCK_MODE') == 'true':
        video_file = os.getenv('MOCK_VIDEO_FILE', 'test_video.mp4')
        camera = cv2.VideoCapture(video_file)
        # 루프 재생 설정
        camera.set(cv2.CAP_PROP_POS_FRAMES, 0)
    else:
        camera = cv2.VideoCapture(CAMERA_INDEX)





---


# 가상 카메라 생성 (Linux)
sudo modprobe v4l2loopback devices=1 video_nr=0

# OBS 대신 FFmpeg로 스크린 캡처 → 가상 카메라
ffmpeg -f x11grab -i :0.0 -vf scale=640:480 -pix_fmt yuv420p -f v4l2 /dev/video0