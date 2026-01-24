import requests
import os

BASE_URL = 'http://172.21.252.222:8080'
TOKEN = '883ada2fc996ab9487bed7a3ba21d2f1'
TEST_FILE = 'test_probe.txt'

if not os.path.exists(TEST_FILE):
    with open(TEST_FILE, 'w') as f:
        f.write('Debug content')

PATHS_TO_TEST = [
    '/dataTransferServer/data',
    '/dataTransferServer/data/',
    '/container/dataTransferServer/data',
    '/container/data',
    '/geoserver/data',
    '/transfer/data',
    '/data',
    '/upload'
]

def probe():
    print(f"Probing {BASE_URL} with token...")
    with open(TEST_FILE, 'rb') as f:
        file_content = f.read()

    for path in PATHS_TO_TEST:
        url = BASE_URL + path
        print(f'Testing {url}...')
        try:
            files = {'datafile': (TEST_FILE, file_content)}
            data = {'name': TEST_FILE}
            headers = {'token': TOKEN}
            
            # Try with 'datafile' field
            response = requests.post(url, files=files, data=data, headers=headers, timeout=3)
            print(f'[{response.status_code}] {url}')
            if response.status_code == 200:
                print('SUCCESS RESPONSE:', response.text)
                return

            # Try with 'file' field just in case
            files_alt = {'file': (TEST_FILE, file_content)}
            response = requests.post(url, files=files_alt, data=data, headers=headers, timeout=3)
            if response.status_code == 200:
                print(f'[{response.status_code}] {url} (field: file)')
                print('SUCCESS RESPONSE:', response.text)
                return

        except Exception as e:
            print(f'[ERROR] {url}: {str(e)}')

probe()
