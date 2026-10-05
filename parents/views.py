from django.shortcuts import render
from .models import Parent
from .serializers import ParentSerializer
from rest_framework import generics


class ParentListCreateView(generics.ListCreateAPIView):
    queryset = Parent.objects.all()
    serializer_class = ParentSerializer