from pypdf import PdfWriter
from pypdf.constants import PageLabelStyle
from pypdf.generic import DictionaryObject, NameObject, TextStringObject


def labeled_writer(source):
    writer = PdfWriter()
    writer.append(source)
    writer.set_page_label(0, 1, style=PageLabelStyle.LOWERCASE_ROMAN)
    writer.set_page_label(2, 2, style=PageLabelStyle.DECIMAL)
    return writer


outline = labeled_writer("tests/fixtures/english.pdf")
parent = outline.add_outline_item("Chapter One", 0)
outline.add_outline_item("First section", 1, parent=parent)
outline.add_outline_item("Chapter Two", 2)
outline.write("tests/fixtures/outline.pdf")

targets = labeled_writer("tests/fixtures/outline.pdf")
targets.add_named_destination("named-second", 1)
for title, destination in [("Named Section", "named-second"), ("Broken target", "missing-target")]:
    reference = targets.add_outline_item(title, 0)
    reference.get_object()[NameObject("/A")] = DictionaryObject({
        NameObject("/S"): NameObject("/GoTo"), NameObject("/D"): TextStringObject(destination)
    })
external = targets.add_outline_item("External link", 0)
external.get_object()[NameObject("/A")] = DictionaryObject({
    NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject("https://example.com")
})
targets.write("tests/fixtures/outline-targets.pdf")
