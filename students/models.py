from django.db import models
from authentication.models import Person


class Student(models.Model):
    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    name = models.CharField(max_length=100)
    student_class = models.IntegerField()
    roll_no = models.IntegerField()
    email = models.EmailField()

    def __str__(self):
        return self.name