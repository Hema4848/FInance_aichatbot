from __future__ import annotations

from io import BytesIO
from typing import Tuple, Optional

import PyPDF2
from docx import Document


def extract_text_from_upload(filename: str, data: bytes) -> Tuple[str, str]:
    """Return (text, detected_type)."""
    name = (filename or "").lower()

    if name.endswith('.pdf'):
        try:
            reader = PyPDF2.PdfReader(BytesIO(data))
            parts = []
            for page in reader.pages:
                try:
                    parts.append(page.extract_text() or '')
                except Exception:
                    parts.append('')
            text = '\n'.join([p for p in parts if p]).strip()
            return text, 'pdf'
        except Exception as e:
            return f"[PDF parse error: {e}]", 'pdf'

    if name.endswith('.docx'):
        try:
            doc = Document(BytesIO(data))
            parts = [p.text for p in doc.paragraphs if (p.text or '').strip()]
            text = '\n'.join(parts).strip()
            return text, 'docx'
        except Exception as e:
            return f"[DOCX parse error: {e}]", 'docx'

    # txt fallback
    if name.endswith('.txt') or True:
        try:
            text = data.decode('utf-8', errors='ignore').strip()
            return text, 'txt'
        except Exception as e:
            return f"[Text decode error: {e}]", 'txt'

