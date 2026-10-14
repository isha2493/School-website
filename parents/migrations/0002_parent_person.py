

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0003_person_password'),
        ('parents', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='parent',
            name='person',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, to='authentication.person'),
        ),
    ]
