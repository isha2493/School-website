from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Class
from .serializers import ClassSerializer, AttendanceSerializer

from authentication.authentication import JWTAuthentication
from assignments.permissions import IsTeacher, IsStudent

from teachers.models import Teacher
from students.models import Student
from parents.models import Parent


def get_teacher(request):
    return Teacher.objects.filter(person=request.user).first()


def get_student(request):
    return Student.objects.filter(person=request.user).first()


class ClassView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):

        role = request.user.role
        classes = Class.objects.none()

        if role == 'teacher':
           
            classes = Class.objects.filter(teacher=get_teacher(request))

        elif role == 'student':
          
            student = get_student(request)
            if student:
                classes = Class.objects.filter(
                    Q(grade_level=student.student_class) |
                    Q(grade_level__isnull=True) |
                    Q(students=student)
                ).distinct()

        elif role == 'parent':
            
            parent = Parent.objects.filter(person=request.user).first()
            if parent and parent.child:
                classes = Class.objects.filter(students=parent.child)

        serializer = ClassSerializer(classes.order_by('id'), many=True)
        return Response(serializer.data)

    def post(self, request):

        teacher = get_teacher(request)

        if teacher is None:
            return Response(
                {"error": "Teacher profile not found"},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ClassSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(teacher=teacher)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


class JoinClassView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        return [IsStudent()]

    def post(self, request):

        student = get_student(request)

        if student is None:
            return Response(
                {"error": "Student profile not found"},
                status=status.HTTP_403_FORBIDDEN
            )

        class_obj = get_object_or_404(Class, id=request.data.get('class_id'))

        
        if (class_obj.grade_level is not None
                and class_obj.grade_level != student.student_class):
            return Response(
                {"error": f"This class is for grade {class_obj.grade_level} students"},
                status=status.HTTP_403_FORBIDDEN
            )

        class_obj.students.add(student)

        return Response(
            {"message": "Joined class successfully"},
            status=status.HTTP_200_OK
        )


class ClassStudentsView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        return [IsTeacher()]

    def get(self, request, class_id):

        class_obj = get_object_or_404(
            Class,
            id=class_id,
            teacher=get_teacher(request)
        )

        data = []

        for student in class_obj.students.all():
            data.append({
                "id": student.id,
                "name": student.name,
                "roll_no": student.roll_no,
                "email": student.email
            })

        return Response(data)


class RemoveStudentView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        return [IsTeacher()]

    def delete(self, request, class_id, student_id):

        class_obj = get_object_or_404(
            Class,
            id=class_id,
            teacher=get_teacher(request)
        )

        student = get_object_or_404(Student, id=student_id)

        class_obj.students.remove(student)

        return Response(
            {"message": "Student removed from class"},
            status=status.HTTP_200_OK
        )


class AttendanceView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        return [IsTeacher()]

    def post(self, request):

        class_obj = get_object_or_404(
            Class,
            id=request.data.get('class_id'),
            teacher=get_teacher(request)
        )

        student = get_object_or_404(Student, id=request.data.get('student_id'))

        if not class_obj.students.filter(id=student.id).exists():
            return Response(
                {"error": "Student is not in this class"},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AttendanceSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(
                class_obj=class_obj,
                student=student
            )

            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )
