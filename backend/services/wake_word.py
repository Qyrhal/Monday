"""
Wake word detection: energy VAD + Whisper keyword check.
No custom model training needed — Whisper detects "Monday" directly.

To swap in a trained openWakeWord model later, replace the WakeWordDetector
class with one that calls openwakeword.Model.predict() per chunk.
"""

import numpy as np

WAKE_WORD = "monday"
VAD_RMS_THRESHOLD = 0.015  # RMS below this = silence


class EnergyVAD:
    """Lightweight energy-based voice activity detector."""

    def __init__(self, rms_threshold: float = VAD_RMS_THRESHOLD):
        self._threshold = rms_threshold

    def is_speech(self, chunk: np.ndarray) -> bool:
        return float(np.sqrt(np.mean(chunk**2))) >= self._threshold
