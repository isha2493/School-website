from django.db import models

# Create your models here.
class Parent(models.Model):
    name = models.CharField(max_length=100)
    child_name = models.CharField(max_length=100)
    child_class = models.IntegerField()
    email = models.EmailField()

    def __str__(self):
            return self.name