import io
import wave
import numpy as np
from faster_whisper import WhisperModel

class STTService:
    def __init__(self, model_size: str = "base"):
        self.model = WhisperModel(model_size, device="cpu", compute_type="int8")

    def transcribe(self, audio_bytes: bytes, ext: str = ".wav") -> str:
        return self.transcribe_array(self._to_float32(audio_bytes))

    def transcribe_array(self, audio: np.ndarray) -> str:
        segments, _ = self.model.transcribe(audio, language="en", beam_size=1)
        text = "".join(s.text for s in segments).strip()
        return text

    @staticmethod
    def _to_float32(audio_bytes: bytes) -> np.ndarray:
        buf = io.BytesIO(audio_bytes)
        with wave.open(buf) as wf:
            frames = wf.readframes(wf.getnframes())
            width = wf.getsampwidth()
            channels = wf.getnchannels()

        dtype = np.int16 if width == 2 else np.int32
        divisor = 32768.0 if width == 2 else 2147483648.0
        samples = np.frombuffer(frames, dtype=dtype).astype(np.float32) / divisor

        if channels > 1:
            samples = samples.reshape(-1, channels).mean(axis=1)

        return samples
