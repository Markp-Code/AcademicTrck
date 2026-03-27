from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET', 'unicaribe-academic-tracker-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Unicaribe Academic Tracker API")

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# ============== MODELS ==============

class UserBase(BaseModel):
    email: EmailStr
    name: str
    student_id: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    career_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(UserBase):
    id: str
    career_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class Career(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    university: str
    total_credits: int
    duration_quarters: int
    format: str

class Subject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    credits: int
    quarter: int
    career_id: str
    prerequisites: List[str] = []  # List of subject codes
    category: str = "General"  # For grouping: Matemáticas, Programación, Seguridad, etc.

class StudentProgressCreate(BaseModel):
    subject_id: str
    status: str  # completed, in_progress, planned, pending
    grade: Optional[float] = None
    override_prerequisite: bool = False
    override_reason: Optional[str] = None

class StudentProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject_id: str
    status: str  # completed, in_progress, planned, pending
    grade: Optional[float] = None
    completed_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OverrideLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject_id: str
    missing_prerequisites: List[str]
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DashboardStats(BaseModel):
    gpa: float
    total_credits: int
    credits_earned: int
    credits_remaining: int
    subjects_completed: int
    subjects_in_progress: int
    subjects_planned: int
    subjects_pending: int
    progress_percentage: float
    honor: Optional[str] = None
    estimated_months_remaining: int
    gpa_by_quarter: List[dict]
    grade_distribution: List[dict]
    gpa_by_category: List[dict]
    available_subjects: List[dict]

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def calculate_gpa_points(grade: float) -> float:
    if grade >= 90:
        return 4.0
    elif grade >= 80:
        return 3.0
    elif grade >= 70:
        return 2.0
    elif grade >= 60:
        return 1.0
    return 0.0

def get_honor(gpa: float) -> Optional[str]:
    if gpa >= 3.90:
        return "Summa Cum Laude"
    elif gpa >= 3.75:
        return "Magna Cum Laude"
    elif gpa >= 3.50:
        return "Cum Laude"
    return None

# ============== AUTH ROUTES ==============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get default career (Cybersecurity)
    career = await db.careers.find_one({}, {"_id": 0})
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        student_id=user_data.student_id,
        career_id=career["id"] if career else None
    )
    
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Initialize progress for all subjects
    if career:
        subjects = await db.subjects.find({"career_id": career["id"]}, {"_id": 0}).to_list(100)
        for subject in subjects:
            progress = StudentProgress(
                user_id=user.id,
                subject_id=subject["id"],
                status="pending"
            )
            progress_dict = progress.model_dump()
            progress_dict["created_at"] = progress_dict["created_at"].isoformat()
            progress_dict["updated_at"] = progress_dict["updated_at"].isoformat()
            await db.student_progress.insert_one(progress_dict)
    
    token = create_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, name=user.name, student_id=user.student_id, career_id=user.career_id)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            student_id=user.get("student_id"),
            career_id=user.get("career_id")
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# ============== CAREER ROUTES ==============

@api_router.get("/careers")
async def get_careers():
    careers = await db.careers.find({}, {"_id": 0}).to_list(100)
    return careers

@api_router.get("/careers/{career_id}")
async def get_career(career_id: str):
    career = await db.careers.find_one({"id": career_id}, {"_id": 0})
    if not career:
        raise HTTPException(status_code=404, detail="Career not found")
    return career

# ============== SUBJECT ROUTES ==============

@api_router.get("/subjects")
async def get_subjects(career_id: Optional[str] = None):
    query = {"career_id": career_id} if career_id else {}
    subjects = await db.subjects.find(query, {"_id": 0}).to_list(100)
    return subjects

@api_router.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

# ============== PROGRESS ROUTES ==============

@api_router.get("/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(100)
    return progress_list

@api_router.get("/progress/detailed")
async def get_detailed_progress(current_user: dict = Depends(get_current_user)):
    """Get progress with subject details"""
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(100)
    
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(100)
    subjects_map = {s["id"]: s for s in subjects}
    
    detailed = []
    for p in progress_list:
        subject = subjects_map.get(p["subject_id"], {})
        detailed.append({
            **p,
            "subject": subject
        })
    
    return detailed

@api_router.put("/progress/{subject_id}")
async def update_progress(
    subject_id: str, 
    data: StudentProgressCreate,
    current_user: dict = Depends(get_current_user)
):
    # Get subject
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Check prerequisites if changing to completed or in_progress
    if data.status in ["completed", "in_progress"] and not data.override_prerequisite:
        prereqs = subject.get("prerequisites", [])
        if prereqs:
            # Get completed subjects
            completed_progress = await db.student_progress.find(
                {"user_id": current_user["id"], "status": "completed"},
                {"_id": 0}
            ).to_list(100)
            completed_subject_ids = [p["subject_id"] for p in completed_progress]
            
            # Get subject codes for completed subjects
            completed_subjects = await db.subjects.find(
                {"id": {"$in": completed_subject_ids}},
                {"_id": 0}
            ).to_list(100)
            completed_codes = [s["code"] for s in completed_subjects]
            
            missing = [p for p in prereqs if p not in completed_codes]
            if missing:
                return {
                    "error": "prerequisites_not_met",
                    "missing_prerequisites": missing,
                    "message": f"Esta materia requiere los siguientes prerrequisitos: {', '.join(missing)}"
                }
    
    # Log override if applicable
    if data.override_prerequisite and data.status in ["completed", "in_progress"]:
        prereqs = subject.get("prerequisites", [])
        if prereqs:
            override_log = OverrideLog(
                user_id=current_user["id"],
                subject_id=subject_id,
                missing_prerequisites=prereqs,
                reason=data.override_reason
            )
            log_dict = override_log.model_dump()
            log_dict["created_at"] = log_dict["created_at"].isoformat()
            await db.override_logs.insert_one(log_dict)
    
    # Update progress
    update_data = {
        "status": data.status,
        "grade": data.grade if data.status == "completed" else None,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.status == "completed" and data.grade is not None:
        update_data["completed_date"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.student_progress.update_one(
        {"user_id": current_user["id"], "subject_id": subject_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        # Create if doesn't exist
        progress = StudentProgress(
            user_id=current_user["id"],
            subject_id=subject_id,
            status=data.status,
            grade=data.grade if data.status == "completed" else None,
            completed_date=datetime.now(timezone.utc) if data.status == "completed" else None
        )
        progress_dict = progress.model_dump()
        progress_dict["created_at"] = progress_dict["created_at"].isoformat()
        progress_dict["updated_at"] = progress_dict["updated_at"].isoformat()
        if progress_dict.get("completed_date"):
            progress_dict["completed_date"] = progress_dict["completed_date"].isoformat()
        await db.student_progress.insert_one(progress_dict)
    
    return {"success": True, "message": "Progress updated successfully"}

# ============== DASHBOARD ROUTES ==============

@api_router.get("/dashboard/stats", response_model=DashboardStats)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    # Get all progress
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    # Get all subjects
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(100)
    subjects_map = {s["id"]: s for s in subjects}
    
    # Calculate stats
    completed = []
    in_progress = []
    planned = []
    pending = []
    
    for p in progress_list:
        subject = subjects_map.get(p["subject_id"])
        if not subject:
            continue
        
        item = {**p, "subject": subject}
        if p["status"] == "completed":
            completed.append(item)
        elif p["status"] == "in_progress":
            in_progress.append(item)
        elif p["status"] == "planned":
            planned.append(item)
        else:
            pending.append(item)
    
    # Calculate GPA
    total_points = 0
    total_credits_earned = 0
    
    for item in completed:
        if item.get("grade") is not None:
            credits = item["subject"]["credits"]
            gpa_points = calculate_gpa_points(item["grade"])
            total_points += gpa_points * credits
            total_credits_earned += credits
    
    gpa = total_points / total_credits_earned if total_credits_earned > 0 else 0.0
    
    # Total credits
    total_credits = sum(s["credits"] for s in subjects)
    credits_remaining = total_credits - total_credits_earned
    
    # Progress percentage
    progress_percentage = (total_credits_earned / total_credits * 100) if total_credits > 0 else 0
    
    # Estimated months remaining
    remaining_subjects = len(in_progress) + len(planned) + len(pending)
    estimated_months = remaining_subjects  # 1 subject per month
    
    # GPA by quarter
    gpa_by_quarter = []
    quarters_data = {}
    for item in completed:
        if item.get("grade") is not None:
            q = item["subject"]["quarter"]
            if q not in quarters_data:
                quarters_data[q] = {"points": 0, "credits": 0}
            credits = item["subject"]["credits"]
            quarters_data[q]["points"] += calculate_gpa_points(item["grade"]) * credits
            quarters_data[q]["credits"] += credits
    
    for q in sorted(quarters_data.keys()):
        data = quarters_data[q]
        quarter_gpa = data["points"] / data["credits"] if data["credits"] > 0 else 0
        gpa_by_quarter.append({"quarter": q, "gpa": round(quarter_gpa, 2), "name": f"C{q}"})
    
    # Grade distribution
    grade_ranges = {"90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "0-59": 0}
    for item in completed:
        if item.get("grade") is not None:
            grade = item["grade"]
            if grade >= 90:
                grade_ranges["90-100"] += 1
            elif grade >= 80:
                grade_ranges["80-89"] += 1
            elif grade >= 70:
                grade_ranges["70-79"] += 1
            elif grade >= 60:
                grade_ranges["60-69"] += 1
            else:
                grade_ranges["0-59"] += 1
    
    grade_distribution = [{"range": k, "count": v} for k, v in grade_ranges.items()]
    
    # GPA by category
    category_data = {}
    for item in completed:
        if item.get("grade") is not None:
            cat = item["subject"].get("category", "General")
            if cat not in category_data:
                category_data[cat] = {"points": 0, "credits": 0}
            credits = item["subject"]["credits"]
            category_data[cat]["points"] += calculate_gpa_points(item["grade"]) * credits
            category_data[cat]["credits"] += credits
    
    gpa_by_category = []
    for cat, data in category_data.items():
        cat_gpa = data["points"] / data["credits"] if data["credits"] > 0 else 0
        gpa_by_category.append({"category": cat, "gpa": round(cat_gpa, 2)})
    
    # Available subjects (prerequisites completed)
    completed_codes = [item["subject"]["code"] for item in completed]
    available = []
    
    for item in pending + planned:
        prereqs = item["subject"].get("prerequisites", [])
        if not prereqs or all(p in completed_codes for p in prereqs):
            available.append({
                "id": item["subject"]["id"],
                "code": item["subject"]["code"],
                "name": item["subject"]["name"],
                "credits": item["subject"]["credits"],
                "quarter": item["subject"]["quarter"]
            })
    
    return DashboardStats(
        gpa=round(gpa, 2),
        total_credits=total_credits,
        credits_earned=total_credits_earned,
        credits_remaining=credits_remaining,
        subjects_completed=len(completed),
        subjects_in_progress=len(in_progress),
        subjects_planned=len(planned),
        subjects_pending=len(pending),
        progress_percentage=round(progress_percentage, 1),
        honor=get_honor(gpa),
        estimated_months_remaining=estimated_months,
        gpa_by_quarter=gpa_by_quarter,
        grade_distribution=grade_distribution,
        gpa_by_category=gpa_by_category,
        available_subjects=available[:10]  # Limit to 10
    )

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    """Seed database with Cybersecurity career and subjects"""
    
    # Check if already seeded
    existing_career = await db.careers.find_one({"name": "Ingeniería en Ciberseguridad"})
    if existing_career:
        return {"message": "Database already seeded"}
    
    # Create career
    career = Career(
        name="Ingeniería en Ciberseguridad",
        university="Unicaribe",
        total_credits=185,
        duration_quarters=12,
        format="Cuatrimestral (1 materia por mes)"
    )
    career_dict = career.model_dump()
    await db.careers.insert_one(career_dict)
    
    # Subject data with categories
    subjects_data = [
        # Primer Cuatrimestre
        {"code": "FGC-101", "name": "Orientación Académica Institucional", "credits": 2, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "FGC-102", "name": "Método del Trabajo Académico", "credits": 2, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "FGC-103", "name": "Metodología de la Investigación", "credits": 3, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "ADE-101", "name": "Administración I", "credits": 3, "quarter": 1, "prerequisites": [], "category": "Administración"},
        
        # Segundo Cuatrimestre
        {"code": "FGC-104", "name": "Lengua Española I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-105", "name": "Matemática Básica I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Matemáticas"},
        {"code": "FGC-106", "name": "Tecnología de la Información y Comunicación I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Tecnología"},
        {"code": "ING-101", "name": "Introducción a la Ingeniería", "credits": 3, "quarter": 2, "prerequisites": [], "category": "Ingeniería"},
        
        # Tercer Cuatrimestre
        {"code": "FGC-107", "name": "Historia Social Dominicana", "credits": 3, "quarter": 3, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-108", "name": "Inglés I", "credits": 3, "quarter": 3, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "DMF-209", "name": "Física I", "credits": 4, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Ciencias"},
        {"code": "QUI-400", "name": "Química I", "credits": 3, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Ciencias"},
        {"code": "MTI-200", "name": "Matemática II", "credits": 4, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Matemáticas"},
        
        # Cuarto Cuatrimestre
        {"code": "FGC-109", "name": "Filosofía", "credits": 2, "quarter": 4, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-110", "name": "Desarrollo Sostenible y Gestión de Riesgos", "credits": 2, "quarter": 4, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "MTI-300", "name": "Matemática III", "credits": 4, "quarter": 4, "prerequisites": ["MTI-200"], "category": "Matemáticas"},
        {"code": "DMF-210", "name": "Física II", "credits": 4, "quarter": 4, "prerequisites": ["DMF-209"], "category": "Ciencias"},
        
        # Quinto Cuatrimestre
        {"code": "MAT-241", "name": "Estadística I", "credits": 3, "quarter": 5, "prerequisites": ["FGC-105"], "category": "Matemáticas"},
        {"code": "ING-102", "name": "Ciencia e Ingeniería de Materiales", "credits": 4, "quarter": 5, "prerequisites": ["QUI-400"], "category": "Ingeniería"},
        {"code": "ING-103", "name": "Cálculo Integral", "credits": 4, "quarter": 5, "prerequisites": ["MTI-300"], "category": "Matemáticas"},
        {"code": "INF-215", "name": "Ingeniería Económica", "credits": 3, "quarter": 5, "prerequisites": ["MTI-200"], "category": "Ingeniería"},
        
        # Sexto Cuatrimestre
        {"code": "MAT-242", "name": "Estadística II", "credits": 3, "quarter": 6, "prerequisites": ["MAT-241"], "category": "Matemáticas"},
        {"code": "ING-105", "name": "Taller de Mecánica de Hardware", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Tecnología"},
        {"code": "ING-104", "name": "Cálculo Vectorial", "credits": 4, "quarter": 6, "prerequisites": ["ING-103"], "category": "Matemáticas"},
        {"code": "INF-222", "name": "Sistema Operativo I", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Programación"},
        {"code": "INF-221", "name": "Introducción a la Programación", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Programación"},
        
        # Séptimo Cuatrimestre
        {"code": "TIC-408", "name": "Seguridad de la Información", "credits": 3, "quarter": 7, "prerequisites": ["FGC-106"], "category": "Seguridad"},
        {"code": "ISW-301", "name": "Taller de Programación I", "credits": 5, "quarter": 7, "prerequisites": ["INF-221"], "category": "Programación"},
        {"code": "INF-437", "name": "Redes Informáticas", "credits": 3, "quarter": 7, "prerequisites": ["INF-222"], "category": "Redes"},
        {"code": "ISW-321", "name": "Taller de Bases de Datos I", "credits": 4, "quarter": 7, "prerequisites": ["INF-221"], "category": "Programación"},
        
        # Octavo Cuatrimestre
        {"code": "INR-215", "name": "Taller de Redes I", "credits": 4, "quarter": 8, "prerequisites": ["INF-437"], "category": "Redes"},
        {"code": "TIC-402", "name": "Ética en Tecnología", "credits": 2, "quarter": 8, "prerequisites": ["FGC-110"], "category": "Formación General"},
        {"code": "INC-404", "name": "Electiva I", "credits": 3, "quarter": 8, "prerequisites": [], "category": "Electiva"},
        {"code": "INC-222", "name": "Ciberdelitos, Ciberterrorismo, Ciberguerra", "credits": 3, "quarter": 8, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        
        # Noveno Cuatrimestre
        {"code": "INC-231", "name": "Criptografía y Criptoanálisis", "credits": 3, "quarter": 9, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        {"code": "INC-315", "name": "Taller Seguridad de Redes y Telecomunicaciones", "credits": 4, "quarter": 9, "prerequisites": ["INR-215"], "category": "Seguridad"},
        {"code": "INC-325", "name": "Taller Seguridad de Sistemas Operativos y Software", "credits": 4, "quarter": 9, "prerequisites": ["INF-222"], "category": "Seguridad"},
        {"code": "INC-331", "name": "Sistema de Gestión de la Seguridad de la Información", "credits": 3, "quarter": 9, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        {"code": "INC-332", "name": "Taller Seguridad de Bases de Datos", "credits": 4, "quarter": 9, "prerequisites": ["ISW-321"], "category": "Seguridad"},
        
        # Décimo Cuatrimestre
        {"code": "INC-411", "name": "Gestión de Riesgos de la Seguridad de la Información", "credits": 3, "quarter": 10, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-333", "name": "Taller Seguridad de Infraestructura Física, Virtual y en la Nube", "credits": 4, "quarter": 10, "prerequisites": ["INC-315"], "category": "Seguridad"},
        {"code": "INC-405", "name": "Electiva II", "credits": 3, "quarter": 10, "prerequisites": [], "category": "Electiva"},
        {"code": "INC-401", "name": "Proyecto de Ciberseguridad - I", "credits": 5, "quarter": 10, "prerequisites": ["INC-331"], "category": "Proyecto"},
        {"code": "INC-403", "name": "Pasantía - Práctica de Ciberseguridad", "credits": 8, "quarter": 10, "prerequisites": ["INC-411"], "category": "Proyecto"},
        
        # Undécimo Cuatrimestre
        {"code": "INC-412", "name": "Marco Legal de la Seguridad de la Información", "credits": 3, "quarter": 11, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-413", "name": "Taller Seguridad en Dispositivos Móviles", "credits": 4, "quarter": 11, "prerequisites": ["INC-325"], "category": "Seguridad"},
        {"code": "INC-402", "name": "Proyecto de Ciberseguridad - II", "credits": 5, "quarter": 11, "prerequisites": ["INC-401"], "category": "Proyecto"},
        {"code": "INC-334", "name": "Ingeniería Social", "credits": 3, "quarter": 11, "prerequisites": ["INC-222"], "category": "Seguridad"},
        {"code": "FGC-111", "name": "Seminario de Grado", "credits": 3, "quarter": 11, "prerequisites": ["FGC-103"], "category": "Formación General"},
        
        # Duodécimo Cuatrimestre
        {"code": "INC-414", "name": "Taller de Seguridad IoT y Entornos Industriales", "credits": 4, "quarter": 12, "prerequisites": ["INC-333"], "category": "Seguridad"},
        {"code": "INC-421", "name": "Análisis Forense en Ciberseguridad", "credits": 4, "quarter": 12, "prerequisites": ["INC-412"], "category": "Seguridad"},
        {"code": "INC-422", "name": "Taller de Auditoría de Seguridad de la Información", "credits": 4, "quarter": 12, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-600", "name": "Proyecto Integrador de Ciberseguridad: Trabajo de Grado", "credits": 6, "quarter": 12, "prerequisites": [], "category": "Proyecto"},
    ]
    
    # Insert subjects
    for subj_data in subjects_data:
        subject = Subject(
            code=subj_data["code"],
            name=subj_data["name"],
            credits=subj_data["credits"],
            quarter=subj_data["quarter"],
            career_id=career.id,
            prerequisites=subj_data["prerequisites"],
            category=subj_data["category"]
        )
        await db.subjects.insert_one(subject.model_dump())
    
    return {"message": "Database seeded successfully", "career_id": career.id, "subjects_count": len(subjects_data)}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    # Auto-seed on startup if empty
    existing = await db.careers.find_one({})
    if not existing:
        logger.info("Seeding database...")
        await seed_database()
        logger.info("Database seeded!")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
