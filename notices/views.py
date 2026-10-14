from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .models import Notice
from .serializers import NoticeSerializer

from authentication.authentication import JWTAuthentication
from assignments.permissions import IsTeacher


class NoticeView(APIView):

    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsTeacher()]
        return []

    def get(self, request):

        notices = Notice.objects.all().order_by('-created_at')

        serializer = NoticeSerializer(
            notices,
            many=True
        )

        return Response(serializer.data)

    def post(self, request):

        serializer = NoticeSerializer(
            data=request.data
        )

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