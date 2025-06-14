
from docxtpl import DocxTemplate

# Load the template
doc = DocxTemplate("C:\\Users\\arrey\\Downloads\\test.docx")

# Define the context (what to replace)
context = {
    'customerName': 'Master',
    'date': 'OpenAI Lab'
}

# Render and save
doc.render(context)
doc.save("output.docx")
