import json
import csv

# Configuración
JSON_PATH = 'tracerfy_response.json'  # Cambia el nombre si tu archivo es diferente
CSV_OUTPUT = 'tracerfy_contacts_output.csv'

# Lee el archivo JSON de respuesta de Tracerfy
def load_tracerfy_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_contacts(data):
    contactos = []
    # Ajusta la ruta según el formato real de tu JSON
    for result in data.get('results', []):
        nombre = result.get('name') or result.get('full_name') or ''
        # Puede ser 'phones', 'phone_numbers', etc. Ajusta si es necesario
        telefonos = result.get('phones') or result.get('phone_numbers') or []
        if isinstance(telefonos, str):
            telefonos = [telefonos]
        emails = result.get('emails') or result.get('email') or []
        if isinstance(emails, str):
            emails = [emails]
        contactos.append({
            'Nombre': nombre,
            'Telefonos': ', '.join(telefonos),
            'Emails': ', '.join(emails)
        })
    return contactos

def print_contacts(contactos):
    for c in contactos:
        print(f"Nombre: {c['Nombre']}")
        print(f"Teléfonos: {c['Telefonos']}")
        print(f"Emails: {c['Emails']}")
        print('-' * 40)

def export_to_csv(contactos, path):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['Nombre', 'Telefonos', 'Emails'])
        writer.writeheader()
        for c in contactos:
            writer.writerow(c)

if __name__ == '__main__':
    data = load_tracerfy_json(JSON_PATH)
    contactos = extract_contacts(data)
    print_contacts(contactos)
    export_to_csv(contactos, CSV_OUTPUT)
    print(f'Exportado a {CSV_OUTPUT}')
