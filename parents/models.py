from django.db import models
from authentication.models import Person
from students.models import Student


class Parent(models.Model):

    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    child = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    name = models.CharField(max_length=100)
    email = models.EmailField()

    def __str__(self):
        return self.name