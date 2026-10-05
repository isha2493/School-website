
from rest_framework import serializers
from django.contrib.auth.hashers import make_password
from .models import Person


class PersonSerializer(serializers.ModelSerializer):

    class Meta:
        model = Person
        fields = ['username', 'email', 'password', 'role', 'roll_no']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        validated_data['password'] = make_password(
            validated_data['password']
        )

        return Person.objects.create(**validated_data)

