# FacePass demo

A small Flask website that recognizes a face in the browser, asks a new visitor for their name and email, and opens a saved profile for a recognized visitor.

## Run it

1. Install Python 3.10 or later.
2. From this folder, install the dependency:

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. Start the website:

   ```powershell
   python app.py
   ```

4. Open <http://127.0.0.1:5000> and allow camera access.

The browser downloads the face detection models and face-api.js from public CDNs, so an internet connection is required. Profiles are stored in `data/profiles.json` on this computer.

## Demo limitations

This project is for learning and local demonstration only. Face descriptors and profile details are stored without encryption, and the face match is not a secure authentication method. Do not use it to protect real accounts or sensitive data.
