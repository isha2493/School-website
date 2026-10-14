from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Assignment, Grade, Submit
from .serializers import AssignmentSerializer, GradeSerializer, SubmitSerializer
from authentication.authentication import JWTAuthentication
from .permissions import IsTeacher, IsStudent

from teachers.models import Teacher
from students.models import Student
from parents.models import Parent
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser


def get_teacher(request):
    return Teacher.objects.filter(person=request.user).first()


def get_student(request):
    return Student.objects.filter(person=request.user).first()


def get_child(request):
    parent = Parent.objects.filter(person=request.user).first()
    return parent.child if parent else None


def error(message, code):
    return Response({'error': message}, status=code)


class AssignmentView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]
    

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):

        role = request.user.role
        assignments = Assignment.objects.none()

        if role == 'teacher':
            assignments = Assignment.objects.filter(teacher=get_teacher(request))

        elif role == 'student':
            student = get_student(request)
            if student:
                assignments = Assignment.objects.filter(class_obj__students=student)

        elif role == 'parent':
            child = get_child(request)
            if child:
                assignments = Assignment.objects.filter(class_obj__students=child)

        serializer = AssignmentSerializer(
            assignments.select_related('class_obj').order_by('due_date', 'id'),
            many=True
        )
        return Response(serializer.data)

    def post(self, request):

        teacher = get_teacher(request)


        serializer = AssignmentSerializer(data=request.data)

        if serializer.is_valid():

          
            class_obj = serializer.validated_data['class_obj']

            if class_obj.teacher_id != teacher.id:
                return error(
                    'You can only create assignments for your own classes',
                    status.HTTP_403_FORBIDDEN
                )

            serializer.save(teacher=teacher)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GradeView(APIView):
    

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
          return [IsTeacher()]
        return []

    def get(self, request):

        role = request.user.role
        grades = Grade.objects.none()

        if role == 'teacher':
            grades = Grade.objects.filter(assignment__teacher=get_teacher(request))

        elif role == 'student':
            student = get_student(request)
            if student:
                grades = Grade.objects.filter(student=student)

        elif role == 'parent':
            child = get_child(request)
            if child:
                grades = Grade.objects.filter(student=child)

        return Response(GradeSerializer(grades.order_by('id'), many=True).data)

    def post(self, request):

        serializer = GradeSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        assignment = serializer.validated_data['assignment']
        student = serializer.validated_data['student']
        teacher = get_teacher(request)

        
        if teacher is None or assignment.teacher_id != teacher.id:
            return error(
                'You can only grade your own assignments',
                status.HTTP_403_FORBIDDEN
            )

        if (assignment.class_obj is None
                or not assignment.class_obj.students.filter(id=student.id).exists()):
            return error(
                'This student is not in the class this assignment belongs to',
                status.HTTP_400_BAD_REQUEST
            )

        if Grade.objects.filter(assignment=assignment, student=student).exists():
            return error(
                'This student has already been graded for this assignment',
                status.HTTP_400_BAD_REQUEST
            )

        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class SubmitView(APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]
   

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsStudent()]
        return []

    def get(self, request):

        role = request.user.role
        submits = Submit.objects.none()

        if role == 'teacher':
            submits = Submit.objects.filter(assignment__teacher=get_teacher(request))

        elif role == 'student':
            submits = Submit.objects.filter(student=get_student(request))

        return Response(
            SubmitSerializer(submits.select_related('student').order_by('id'), many=True).data
        )

    def post(self, request):

        student = get_student(request)

        if student is None:
            return error('Student profile not found', status.HTTP_403_FORBIDDEN)

        serializer = SubmitSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        assignment = serializer.validated_data['assignment']

        if (assignment.class_obj is None
                or not assignment.class_obj.students.filter(id=student.id).exists()):
            return error(
                'This assignment is not for your class',
                status.HTTP_403_FORBIDDEN
            )

        if Submit.objects.filter(assignment=assignment, student=student).exists():
            return error(
                'You have already submitted this assignment',
                status.HTTP_400_BAD_REQUEST
            )

        serializer.save(student=student)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
