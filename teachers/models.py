from django.db import models
from authentication.models import Person

# Create your models here.
class Teacher(models.Model):

    person = models.ForeignKey(
        Person,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    name = models.CharField(max_length=100)
    email = models.EmailField()

    def __str__(self):
            return self.name