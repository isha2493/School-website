from rest_framework import generics
from .models import Student
from .serializers import StudentSerializer
import csv,io
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from assignments.permissions import IsTeacher
from authentication.authentication import JWTAuthentication
from authentication.models import Person
from django.db import transaction
from django.contrib.auth.hashers import make_password


class StudentListCreateView(generics.ListCreateAPIView):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer

class StudentCSVUploadView(APIView):

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacher]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')

        if not file:
            return Response(
                {'error': 'No CSV file uploaded'},
                status=400
            )

        try:
            reader = csv.DictReader(
                io.TextIOWrapper(file, encoding='utf-8-sig')
            )

            required_columns = {
                'username', 'email', 'password',
                'role', 'roll_no', 'student_class'
            }

            if not reader.fieldnames or not required_columns.issubset(
                set(reader.fieldnames)
            ):
                return Response(
                    {'error': 'CSV headers are missing or incorrect'},
                    status=400
                )

            registered = 0
            errors = []

            for row_number, row in enumerate(reader, start=2):
                username = (row.get('username') or '').strip()
                email = (row.get('email') or '').strip()
                password = row.get('password') or ''
                role = (row.get('role') or '').strip().lower()
                roll_no = (row.get('roll_no') or '').strip()
                student_class = (row.get('student_class') or '').strip()

                if not all([
                    username, email, password,
                    role, roll_no, student_class
                ]):
                    errors.append(
                        f'Row {row_number}: Missing student information'
                    )
                    continue

                if role != 'student':
                    errors.append(
                        f'Row {row_number}: Role must be student'
                    )
                    continue

                if Person.objects.filter(email=email).exists():
                    errors.append(
                        f'Row {row_number}: Email already exists'
                    )
                    continue

                try:
                    student_class = int(student_class)

                    with transaction.atomic():
                        person = Person.objects.create(
                            username=username,
                            email=email,
                            password=make_password(password),
                            role='student',
                            roll_no=roll_no
                        )

                        Student.objects.create(
                            person=person,
                            name=username,
                            email=email,
                            roll_no=roll_no,
                            student_class=student_class
                        )

                    registered += 1

                except (ValueError, TypeError):
                    errors.append(
                        f'Row {row_number}: Invalid student class'
                    )

        except (UnicodeDecodeError, csv.Error):
            return Response(
                {'error': 'Could not read the CSV file'},
                status=400
            )

        return Response({
            'message': 'CSV processing completed',
            'registered': registered,
            'errors': errors
        })
