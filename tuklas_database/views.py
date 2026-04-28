from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import User, Student

@api_view(['POST'])
def register(request):
    username = request.data.get('username')
    password = request.data.get('password')
    role = request.data.get('role')

    user = User.objects.create(username=username, role=role)
    user.set_password(password)
    user.save()

    if role == "student":
        Student.objects.create(
            user=user,
            student_id=request.data.get('student_id'),
            name=request.data.get('name')
        )

    return Response({"message": "Registered successfully"})

from django.contrib.auth import authenticate

@api_view(['POST'])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)

    if user:
        return Response({
            "message": "Login success",
            "role": user.role
        })
    else:
        return Response({"error": "Invalid login"})