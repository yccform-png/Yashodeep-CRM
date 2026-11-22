import json
import urllib.parse
from typing import List, Optional, Union, Any
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )

    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "super-secret-institute-jwt-key-change-in-production-min-32-chars-long!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "institute_admin"
    POSTGRES_PASSWORD: str = "institute_secure_password_2026"
    POSTGRES_DB: str = "institute_erp"
    DATABASE_URL: Optional[str] = None
    SYNC_DATABASE_URL: Optional[str] = None

    @computed_field
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
            # Sanitize query parameters for asyncpg compatibility (e.g. Neon, AWS RDS, Supabase)
            parsed = urllib.parse.urlsplit(url)
            if parsed.query:
                query_params = urllib.parse.parse_qs(parsed.query)
                # asyncpg uses 'ssl' instead of 'sslmode'
                if "sslmode" in query_params:
                    mode = query_params.pop("sslmode")[0]
                    if mode in ("require", "verify-ca", "verify-full"):
                        query_params["ssl"] = ["require"]
                # Remove libpq parameters unsupported by asyncpg
                query_params.pop("channel_binding", None)
                query_params.pop("target_session_attrs", None)
                new_query = urllib.parse.urlencode([(k, v) for k, vs in query_params.items() for v in vs])
                url = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, new_query, parsed.fragment))
            return url
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @computed_field
    @property
    def sync_database_url(self) -> str:
        if self.SYNC_DATABASE_URL:
            return self.SYNC_DATABASE_URL
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
            elif url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_ENABLED: bool = True
    REDIS_DEFAULT_TTL: int = 300
    REDIS_SOCKET_TIMEOUT: float = 5.0
    REDIS_CONNECT_TIMEOUT: float = 5.0

    # Superuser initialization
    FIRST_SUPERUSER_EMAIL: str = "admin@institute.edu"
    FIRST_SUPERUSER_PASSWORD: str = "AdminSecurePass@2026!"
    FIRST_SUPERUSER_FIRSTNAME: str = "Super"
    FIRST_SUPERUSER_LASTNAME: str = "Admin"

    # Institute Defaults
    INSTITUTE_NAME: str = "Yashodeep Coaching Classes"
    INSTITUTE_CODE: str = "YCC-MAIN"
    INSTITUTE_EMAIL: str = "info@yashodeepcoachingclasses.in"
    INSTITUTE_PHONE: str = "+919876543210"

    # Payment Gateways (Optional)
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None

    # Meta Cloud API - WhatsApp Business Platform
    META_WHATSAPP_ENABLED: bool = False
    META_WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    META_WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None
    META_WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    META_WHATSAPP_API_VERSION: str = "v21.0"
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: str = "ycc_meta_webhook_secret_verify_token_2026"

    # Brevo - Transactional Email
    BREVO_EMAIL_ENABLED: bool = False
    BREVO_API_KEY: Optional[str] = None
    BREVO_SENDER_NAME: str = "Yashodeep Coaching Classes"
    BREVO_SENDER_EMAIL: str = "admissions@yashodeepcoachingclasses.in"

    # CORS
    BACKEND_CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://yashodeep-crm.vercel.app"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if not v:
                return [
                    "http://localhost:5173",
                    "http://localhost:3000",
                    "http://127.0.0.1:5173",
                    "http://127.0.0.1:3000",
                    "https://yashodeep-crm.vercel.app"
                ]
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    # Handle single quotes: ['https://...']
                    v = v.strip("[]").replace("'", '"')
                    try:
                        return json.loads(f"[{v}]")
                    except Exception:
                        pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, tuple)):
            return list(v)
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
            "https://yashodeep-crm.vercel.app"
        ]


settings = Settings()
