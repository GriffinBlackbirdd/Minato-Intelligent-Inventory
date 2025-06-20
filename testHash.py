import hashlib

password = "Sakura@7117"
hashed = hashlib.sha256(password.encode()).hexdigest()
print("SHA-256:", hashed)
