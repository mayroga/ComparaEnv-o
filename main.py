# main.py — REMESAS | May Roga LLC
# FastAPI + Remittance Engine + Stripe
# Plataforma de comparación y asistencia para remesas.
# No ejecuta transferencias.
# No guarda credenciales ni datos sensibles.
# El cerebro interno vive en data/app_brain.json.

import os
import secrets
from pathlib import Path
from typing import Any, Dict, Optional

import stripe
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from remittance_engine import engine
from schemas import (
    ComparisonRequest,
    ComparisonResponse,
    DeleteLocalDataResponse,
    FinalCheckRequest,
    FinalCheckResponse,
    ParseNeedRequest,
    ParsedNeed,
    SessionResponse,
    UserNeedRequest,
)


# ============================================================
# APP
# ============================================================

APP_NAME = "REMESAS"
APP_VERSION = "1.0.0"

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = BASE_DIR / "data"
BRAIN_FILE = DATA_DIR / "app_brain.json"

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description=(
        "Plataforma de comparación y asistencia "
        "para remesas."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================
# STATIC
# ============================================================

if STATIC_DIR.exists():
    app.mount(
        "/static",
        StaticFiles(
            directory=str(STATIC_DIR)
        ),
        name="static",
    )


# ============================================================
# STRIPE
# ============================================================

STRIPE_SECRET_KEY = os.getenv(
    "STRIPE_SECRET_KEY",
    "",
)

STRIPE_PRICE_ID = os.getenv(
    "STRIPE_PRICE_ID",
    "",
)

STRIPE_SUCCESS_URL = os.getenv(
    "STRIPE_SUCCESS_URL",
    "",
)

STRIPE_CANCEL_URL = os.getenv(
    "STRIPE_CANCEL_URL",
    "",
)

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY


# ============================================================
# INTERNAL CONFIG
# ============================================================

SESSION_COOKIE_NAME = "remesas_session"

MAX_BODY_SIZE = 1024 * 1024

ALLOWED_LANGUAGES = {
    "es",
    "en",
}


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event() -> None:
    """
    Loads and validates the application brain.

    If the brain cannot be loaded, the application must not
    silently operate with invented or incomplete rules.
    """

    engine.load_brain()


# ============================================================
# ROOT
# ============================================================

@app.get(
    "/",
    include_in_schema=False,
)
async def root() -> FileResponse:
    index_file = STATIC_DIR / "index.html"

    if not index_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Application interface not found.",
        )

    return FileResponse(
        str(index_file)
    )


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
async def health() -> Dict[str, Any]:
    brain = engine.brain_info()

    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "brain_loaded": bool(
            engine.brain
        ),
        "brain_version": brain.get(
            "version"
        ),
    }


# ============================================================
# PUBLIC APP CONFIGURATION
# ============================================================

@app.get(
    "/api/config",
)
async def public_configuration(
    language: str = "es",
) -> Dict[str, Any]:

    language = normalize_language(
        language
    )

    return engine.client_configuration(
        language
    )


# ============================================================
# BRAIN VERSION
# ============================================================

@app.get(
    "/api/brain/version",
)
async def brain_version() -> Dict[str, Any]:
    """
    Only public version information.
    The internal brain itself is never exposed.
    """

    return engine.brain_info()


# ============================================================
# SESSION
# ============================================================

@app.post(
    "/api/session",
    response_model=SessionResponse,
)
async def create_session(
    language: str = "es",
) -> SessionResponse:

    language = normalize_language(
        language
    )

    session = engine.create_session(
        language
    )

    return SessionResponse(
        success=True,
        session=session,
        message=localized(
            "Sesión iniciada.",
            "Session started.",
            language,
        ),
    )


@app.get(
    "/api/session/{session_id}",
    response_model=SessionResponse,
)
async def get_session(
    session_id: str,
) -> SessionResponse:

    validate_session_id(
        session_id
    )

    session = engine.get_session(
        session_id
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    return SessionResponse(
        success=True,
        session=session,
    )


@app.delete(
    "/api/session/{session_id}",
)
async def delete_session(
    session_id: str,
) -> Dict[str, Any]:

    validate_session_id(
        session_id
    )

    deleted = engine.clear_session(
        session_id
    )

    return {
        "success": deleted,
        "message": (
            "Session cleared."
            if deleted
            else "Session already cleared."
        ),
    }


# ============================================================
# USER NEED
# ============================================================

@app.post(
    "/api/need",
    response_model=SessionResponse,
)
async def apply_need(
    request: UserNeedRequest,
) -> SessionResponse:

    session_id = request_session_id(
        request
    )

    if not session_id:
        session = engine.create_session(
            request.language
        )
        session_id = session.session_id

    try:
        session = engine.apply_user_need(
            session_id,
            request,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    return SessionResponse(
        success=True,
        session=session,
    )


# ============================================================
# FREE TEXT
# ============================================================

@app.post(
    "/api/need/parse",
)
async def parse_need(
    request: ParseNeedRequest,
) -> Dict[str, Any]:

    parsed = engine.parse_need(
        text=request.text,
        current_amount=request.current_amount,
        current_destination_country=(
            request.current_destination_country
        ),
        language=request.language,
    )

    return {
        "success": True,
        "parsed": parsed,
    }


@app.post(
    "/api/session/{session_id}/need/parse",
)
async def parse_need_into_session(
    session_id: str,
    request: ParseNeedRequest,
) -> Dict[str, Any]:

    validate_session_id(
        session_id
    )

    try:
        session, parsed = engine.apply_free_text(
            session_id=session_id,
            text=request.text,
            language=request.language,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        )

    return {
        "success": True,
        "parsed": parsed,
        "session": session,
    }


# ============================================================
# COMPARISON
# ============================================================

@app.post(
    "/api/compare",
    response_model=ComparisonResponse,
)
async def compare(
    request: ComparisonRequest,
) -> ComparisonResponse:

    if not request.destination_country:
        raise HTTPException(
            status_code=422,
            detail="Destination country is required.",
        )

    if request.amount <= 0:
        raise HTTPException(
            status_code=422,
            detail="Amount must be greater than zero.",
        )

    return engine.compare(
        request
    )


@app.post(
    "/api/session/{session_id}/compare",
    response_model=ComparisonResponse,
)
async def compare_session(
    session_id: str,
) -> ComparisonResponse:

    validate_session_id(
        session_id
    )

    session = engine.get_session(
        session_id
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    if session.amount is None:
        raise HTTPException(
            status_code=422,
            detail="Amount is required.",
        )

    if not session.destination_country:
        raise HTTPException(
            status_code=422,
            detail="Destination country is required.",
        )

    request = ComparisonRequest(
        language=session.language,
        amount=session.amount,
        send_currency=session.send_currency,
        destination_country=(
            session.destination_country
        ),
        priority=session.priority,
        urgency=session.urgency,
        delivery_method=(
            session.delivery_method
        ),
        payment_method=(
            session.payment_method
        ),
        special_need=session.special_need,
        provider_ids=session.candidate_providers,
    )

    result = engine.compare(
        request
    )

    # Store only the verified results temporarily.
    if result.results:
        engine.update_session(
            session_id,
            verified_results=result.results,
            current_step="comparison",
        )

    return result


# ============================================================
# SELECT OPTION
# ============================================================

@app.post(
    "/api/session/{session_id}/select/{provider_id}",
)
async def select_provider_option(
    session_id: str,
    provider_id: str,
) -> Dict[str, Any]:

    validate_session_id(
        session_id
    )

    session = engine.get_session(
        session_id
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    option = None

    for result in session.verified_results:
        if result.provider_id == provider_id:
            option = result
            break

    if option is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Verified provider option "
                "not found."
            ),
        )

    try:
        updated = engine.select_option(
            session_id,
            option,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    return {
        "success": True,
        "session": updated,
        "selected_option": option,
    }


# ============================================================
# FINAL CHECK
# ============================================================

@app.post(
    "/api/final-check",
    response_model=FinalCheckResponse,
)
async def final_check(
    request: FinalCheckRequest,
) -> FinalCheckResponse:

    return engine.final_check(
        request
    )


@app.post(
    "/api/session/{session_id}/final-check",
    response_model=FinalCheckResponse,
)
async def session_final_check(
    session_id: str,
) -> FinalCheckResponse:

    validate_session_id(
        session_id
    )

    session = engine.get_session(
        session_id
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Session not found.",
        )

    option = session.selected_option

    if option is None:
        raise HTTPException(
            status_code=422,
            detail="No option selected.",
        )

    request = FinalCheckRequest(
        language=session.language,
        provider_id=option.provider_id,
        amount=(
            option.amount_sent
            or session.amount
            or 0
        ),
        send_currency=(
            option.send_currency
            or session.send_currency
        ),
        destination_country=(
            session.destination_country
            or ""
        ),
        delivery_method=(
            option.delivery_method
        ),
        payment_method=(
            option.payment_method
        ),
        recipient_amount=(
            option.recipient_amount
        ),
        fee=option.fee,
        exchange_rate=(
            option.exchange_rate
        ),
        recipient_information_entered=False,
    )

    result = engine.final_check(
        request
    )

    engine.update_session(
        session_id,
        final_check=result.model_dump(),
        current_step="final_check",
    )

    return result


# ============================================================
# HELP
# ============================================================

@app.get(
    "/api/session/{session_id}/help",
)
async def session_help(
    session_id: str,
    language: str = "es",
) -> Dict[str, Any]:

    validate_session_id(
        session_id
    )

    language = normalize_language(
        language
    )

    message = engine.help_current_step(
        session_id,
        language,
    )

    return {
        "success": True,
        "message": message,
    }


# ============================================================
# RESET
# ============================================================

@app.post(
    "/api/session/{session_id}/reset",
)
async def reset_session(
    session_id: str,
) -> Dict[str, Any]:

    validate_session_id(
        session_id
    )

    deleted = engine.reset_user_session(
        session_id
    )

    return {
        "success": True,
        "cleared": deleted,
        "message": (
            "Sesión borrada."
            if deleted
            else "La sesión ya estaba limpia."
        ),
    }


# ============================================================
# LOCAL DATA
# ============================================================

@app.delete(
    "/api/local-data",
    response_model=DeleteLocalDataResponse,
)
async def local_data_info() -> DeleteLocalDataResponse:
    """
    Server does not control browser localStorage.
    The frontend performs the actual local deletion.

    This endpoint exists only to make the contract explicit.
    """

    return DeleteLocalDataResponse(
        success=True,
        message=(
            "El borrado de datos locales se realiza "
            "en este dispositivo."
        ),
    )


# ============================================================
# STRIPE
# ============================================================

@app.get(
    "/api/subscription/status",
)
async def subscription_status() -> Dict[str, Any]:

    configured = bool(
        STRIPE_SECRET_KEY
        and STRIPE_PRICE_ID
    )

    return {
        "configured": configured,
        "price": 15.99,
        "currency": "USD",
        "period": "1_month",
    }


@app.post(
    "/api/create-checkout-session",
)
async def create_checkout_session(
    request: Request,
) -> Dict[str, Any]:

    if not STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe is not configured."
            ),
        )

    if not STRIPE_PRICE_ID:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe Price ID is not configured."
            ),
        )

    if not STRIPE_SUCCESS_URL:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe success URL is not configured."
            ),
        )

    if not STRIPE_CANCEL_URL:
        raise HTTPException(
            status_code=503,
            detail=(
                "Stripe cancel URL is not configured."
            ),
        )

    try:
        checkout = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[
                {
                    "price": STRIPE_PRICE_ID,
                    "quantity": 1,
                }
            ],
            success_url=(
                STRIPE_SUCCESS_URL
                + "?session_id={CHECKOUT_SESSION_ID}"
            ),
            cancel_url=STRIPE_CANCEL_URL,
            allow_promotion_codes=True,
            billing_address_collection="auto",
        )

    except stripe.error.StripeError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to create the payment "
                "session."
            ),
        )

    return {
        "success": True,
        "checkout_url": checkout.url,
    }


# ============================================================
# STRIPE CHECK
# ============================================================

@app.get(
    "/api/payment/check",
)
async def payment_check(
    session_id: Optional[str] = None,
) -> Dict[str, Any]:

    if not STRIPE_SECRET_KEY:
        return {
            "success": False,
            "active": False,
            "message": "Stripe not configured.",
        }

    if not session_id:
        return {
            "success": False,
            "active": False,
            "message": "Payment session not provided.",
        }

    try:
        checkout = (
            stripe.checkout.Session.retrieve(
                session_id
            )
        )

        active = (
            checkout.payment_status
            == "paid"
        )

        if (
            checkout.mode
            == "subscription"
            and checkout.subscription
        ):
            active = active or bool(
                checkout.subscription
            )

        return {
            "success": True,
            "active": active,
            "payment_status": (
                checkout.payment_status
            ),
            "checkout_status": (
                checkout.status
            ),
        }

    except stripe.error.StripeError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to verify payment."
            ),
        )


# ============================================================
# ERROR HANDLING
# ============================================================

@app.exception_handler(
    ValueError
)
async def value_error_handler(
    request: Request,
    exc: ValueError,
) -> JSONResponse:

    return JSONResponse(
        status_code=400,
        content={
            "success": False,
            "error": str(exc),
        },
    )


@app.exception_handler(
    Exception
)
async def generic_error_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:

    # Do not expose internal exception details.
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": (
                "Ocurrió un problema. "
                "Intenta nuevamente."
            ),
        },
    )


# ============================================================
# SECURITY / VALIDATION HELPERS
# ============================================================

def normalize_language(
    language: Optional[str],
) -> str:

    language = (
        language or "es"
    ).lower().strip()

    if language not in ALLOWED_LANGUAGES:
        return "es"

    return language


def validate_session_id(
    session_id: str,
) -> None:

    if not session_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid session.",
        )

    if len(session_id) > 128:
        raise HTTPException(
            status_code=400,
            detail="Invalid session.",
        )

    if not all(
        char.isalnum()
        for char in session_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid session.",
        )


def request_session_id(
    request: UserNeedRequest,
) -> Optional[str]:
    """
    UserNeedRequest intentionally does not contain
    session_id in the schema.

    The frontend should use /api/session first and
    then operate against the returned session ID.

    This helper remains here so main.py can be extended
    without changing the public model contract.
    """

    return None


def localized(
    es: str,
    en: str,
    language: str,
) -> str:

    return (
        en
        if language == "en"
        else es
    )


# ============================================================
# OPTIONAL UPTIME / ROOT PING
# ============================================================

@app.get(
    "/ping",
    include_in_schema=False,
)
async def ping() -> Dict[str, str]:
    return {
        "status": "ok"
    }
