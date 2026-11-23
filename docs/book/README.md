# Project book generator

Rebuild the PDF from the project root:

```bash
python3 -m venv .venv-book && .venv-book/bin/pip install -q reportlab
.venv-book/bin/python docs/book/make_book.py app/node_modules/@expo-google-fonts docs/MiniTag_Project_Book.pdf
```

`design-*.png` are the 14 screens from the Stella Tracker App design canvas, in canvas order.
