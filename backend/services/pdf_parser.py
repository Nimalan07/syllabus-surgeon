import io
import pdfplumber

class PDFExtractionError(Exception):
    pass

def extract_text(pdf_bytes: bytes) -> str:
    try:
        pages = []
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
        text = "\n\n".join(pages).strip()
        if len(text) < 40:
            raise PDFExtractionError("This PDF contains too little readable text. It may be scanned or image-based.")
        return text
    except PDFExtractionError:
        raise
    except Exception as exc:
        raise PDFExtractionError(f"Could not read the PDF: {exc}") from exc
