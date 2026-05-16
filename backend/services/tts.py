import io
import os
import tempfile


class TTSService:
    def __init__(self):
        self._init_engine()

    def _init_engine(self):
        try:
            from supertonic import TTS

            self.engine = TTS(auto_download=True)
            self.backend = "supertonic"
        except ImportError:
            import pyttsx3

            self.engine = pyttsx3.init()
            self.backend = "pyttsx3"

    def synthesize(self, text: str, voice: str = "M1") -> bytes:
        if self.backend == "supertonic":
            return self._synthesize_supertonic(text, voice)
        return self._synthesize_pyttsx3(text)

    def _synthesize_supertonic(self, text: str, voice: str) -> bytes:
        voice_name = "M1" if voice in ("default", "") else voice
        style = self.engine.get_voice_style(voice_name=voice_name)
        wav, _ = self.engine.synthesize(text, voice_style=style, lang="en")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        try:
            self.engine.save_audio(wav, path)
            with open(path, "rb") as f:
                return f.read()
        finally:
            os.unlink(path)

    def _synthesize_pyttsx3(self, text: str) -> bytes:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            path = f.name
        self.engine.save_to_file(text, path)
        self.engine.runAndWait()
        with open(path, "rb") as f:
            data = f.read()
        os.unlink(path)
        return data
