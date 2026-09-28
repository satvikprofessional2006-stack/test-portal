"""
Accounts serializers — full implementation in Milestone 2.
Placeholder so imports in tests don't fail during M1.
"""
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default JWT serializer to include user role and name in the token.
    This is referenced in settings.SIMPLE_JWT so it must exist before migrate.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom claims so the frontend can read role without an extra API call
        token["role"] = user.role
        token["full_name"] = user.full_name
        token["email"] = user.email
        return token
