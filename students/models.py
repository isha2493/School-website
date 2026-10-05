
from django.db import models


class Student(models.Model):
    name = models.CharField(max_length=100)
    student_class = models.IntegerField()
    roll_no = models.IntegerField()
    email = models.EmailField()

    def __str__(self):
        return self.name