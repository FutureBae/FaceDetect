import json
import math
import os
import re
import tempfile
from pathlib import Path
from threading import RLock

from flask import Flask, jsonify, render_template, request


app = Flask(__name__, template_folder=".")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024

DATA_DIR = Path(__file__).parent / "data"
PROFILES_FILE = DATA_DIR / "profiles.json"
DESCRIPTOR_SIZE = 128
MATCH_THRESHOLD = 0.52
profiles_lock = RLock()


def read_profiles():
    if not PROFILES_FILE.exists():
        return []

    with PROFILES_FILE.open(encoding="utf-8") as profiles_file:
        profiles = json.load(profiles_file)
    if not isinstance(profiles, list):
        raise ValueError("The profiles database must contain a list.")
    return profiles


def write_profiles(profiles):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        dir=DATA_DIR,
        delete=False,
    ) as temporary_file:
        json.dump(profiles, temporary_file, indent=2)
        temporary_path = Path(temporary_file.name)
    os.replace(temporary_path, PROFILES_FILE)


def read_descriptor(payload):
    if not isinstance(payload, dict):
        return None
    descriptor = payload.get("descriptor")
    if not isinstance(descriptor, list) or len(descriptor) != DESCRIPTOR_SIZE:
        return None
    if any(
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        for value in descriptor
    ):
        return None
    return [float(value) for value in descriptor]


def find_profile(profiles, descriptor):
    best_profile = None
    best_distance = MATCH_THRESHOLD
    for profile in profiles:
        saved_descriptor = profile.get("descriptor")
        if not isinstance(saved_descriptor, list) or len(saved_descriptor) != DESCRIPTOR_SIZE:
            continue
        distance = math.sqrt(
            sum((left - right) ** 2 for left, right in zip(descriptor, saved_descriptor))
        )
        if distance < best_distance:
            best_profile = profile
            best_distance = distance
    return best_profile


def public_profile(profile):
    return {"id": profile["id"], "name": profile["name"], "email": profile["email"]}


@app.get("/")
def home():
    return render_template("index.html")


@app.post("/api/recognize")
def recognize():
    descriptor = read_descriptor(request.get_json(silent=True))
    if descriptor is None:
        return jsonify(error="A valid 128-number face descriptor is required."), 400

    with profiles_lock:
        profile = find_profile(read_profiles(), descriptor)
    if profile is None:
        return jsonify(recognized=False), 200
    return jsonify(recognized=True, profile=public_profile(profile)), 200


@app.post("/api/register")
def register():
    payload = request.get_json(silent=True)
    descriptor = read_descriptor(payload)
    if descriptor is None:
        return jsonify(error="A valid 128-number face descriptor is required."), 400

    name = payload.get("name")
    email = payload.get("email")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 80:
        return jsonify(error="Name must be between 1 and 80 characters."), 400
    if not isinstance(email, str) or len(email.strip()) > 254 or not re.fullmatch(
        r"[^\s@]+@[^\s@]+\.[^\s@]+", email.strip()
    ):
        return jsonify(error="Enter a valid email address."), 400
    name = name.strip()
    email = email.strip()

    with profiles_lock:
        profiles = read_profiles()
        if find_profile(profiles, descriptor) is not None:
            return jsonify(error="This face is already registered. Try scanning again."), 409
        profile = {
            "id": os.urandom(8).hex(),
            "name": name,
            "email": email,
            "descriptor": descriptor,
        }
        profiles.append(profile)
        write_profiles(profiles)

    return jsonify(profile=public_profile(profile)), 201


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
