import jwt
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import Person


class JWTAuthentication(BaseAuthentication):

    def authenticate(self, request):

        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return None

        try:
            token = auth_header.split(' ')[1]

            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=['HS256']
            )

            person_id = payload.get('person_id')

            person = Person.objects.get(id=person_id)

            return (person, token)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired')

        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')

        except Person.DoesNotExist:
            raise AuthenticationFailed('Person not found')