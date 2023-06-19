import requests

url = "https://example.com/api/endpoint"  # Replace with the actual API endpoint URL

for _ in range(100):
    request_body = {
        "serviceType": "voice",
        "unit": -2
    }

    response = requests.post(url, json=request_body)

    if response.status_code == 200:
        # Request succeeded
        print("Request succeeded!")
        print("Response:", response.json())
    else:
        # Request failed
        print("Request failed with status code:", response.status_code)
        print("Error message:", response.text)
