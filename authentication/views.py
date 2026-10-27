import jwt

from django.conf import settings
from django.contrib.auth.hashers import check_password

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Person
from .serializers import PersonSerializer
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser

from authentication.authentication import JWTAuthentication
from .serializers import PersonSerializer, StudentRegistrationSerializer, ParentRegistrationSerializer
from assignments.permissions import IsTeacher, IsStudent


class TeacherRegisterView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):

        serializer = PersonSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {'message': 'Registration successful'},
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class StudentRegisterView(APIView):
    permission_classes = [IsTeacher]
    authentication_classes = [JWTAuthentication]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):

        serializer = StudentRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {'message': 'Registration successful'},
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

class ParentRegisterView(APIView):
    permission_classes = [IsTeacher]
    authentication_classes = [JWTAuthentication]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request):

        serializer = ParentRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()

            return Response(
                {'message': 'Registration successful'},
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
class LoginView(APIView):

    def post(self, request):

        email = request.data.get('email')
        password = request.data.get('password')

        person = Person.objects.filter(email=email).first()

        if not person:
            return Response(
                {'error': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not check_password(password, person.password):
            return Response(
                {'error': 'Invalid email or password'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        token = jwt.encode(
            {
                'person_id': person.id,
                'role': person.role
            },
            settings.SECRET_KEY,
            algorithm='HS256'
        )

        return Response({
            'token': token,
            'role': person.role
        })
    
class ProfileUpdateView(APIView):
    authentication_classes = [JWTAuthentication]
    parser_classes = [MultiPartParser, FormParser]

    def patch(self, request):
        person = request.user

        serializer = PersonSerializer(
            person,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
class ProfileView(APIView):
    authentication_classes = [JWTAuthentication]

    def get(self, request):
        serializer = PersonSerializer(request.user)
        return Response(serializer.data)