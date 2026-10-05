from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Assignment
from .serializers import AssignmentSerializer
from authentication.authentication import JWTAuthentication
from .permissions import IsTeacher


class AssignmentView(APIView):

    authentication_classes = [JWTAuthentication]

    def get(self, request):
        assignments = Assignment.objects.all()
        serializer = AssignmentSerializer(assignments, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = AssignmentSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    def get_permissions(self):

        if self.request.method == 'POST':
            return [IsTeacher()]

        return []