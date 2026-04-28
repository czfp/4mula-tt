import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

users = []

@csrf_exempt
def register(request):
    if request.method == "POST":
        data = json.loads(request.body)
        users.append(data)
        return JsonResponse({"message": "Registered successfully"})

@csrf_exempt
def login(request):
    if request.method == "POST":
        data = json.loads(request.body)

        for user in users:
            if user["username"] == data["username"] and user["password"] == data["password"]:
                return JsonResponse({"message": "Login successful"})

        return JsonResponse({"error": "Invalid credentials"}, status=401)