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
JWT_SECRET = os.environ.get('JWT_SECRET', 'uniprogress-academic-tracker-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="UniProgress Academic Tracker API")

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
    university_id: Optional[str] = None
    career_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    university_id: Optional[str] = None
    career_id: Optional[str] = None
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserResponse(UserBase):
    id: str
    university_id: Optional[str] = None
    career_id: Optional[str] = None
    is_admin: bool = False

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class University(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    country: str = "República Dominicana"
    logo_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UniversityCreate(BaseModel):
    name: str
    country: str = "República Dominicana"
    logo_url: Optional[str] = None

class Career(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    university_id: str
    total_credits: int
    duration_quarters: int
    format: str = "Cuatrimestral"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CareerCreate(BaseModel):
    name: str
    university_id: str
    total_credits: int
    duration_quarters: int
    format: str = "Cuatrimestral"

class Subject(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    credits: int
    quarter: int
    career_id: str
    prerequisites: List[str] = []
    category: str = "General"

class SubjectCreate(BaseModel):
    code: str
    name: str
    credits: int
    quarter: int
    career_id: str
    prerequisites: List[str] = []
    category: str = "General"

class StudentProgressCreate(BaseModel):
    subject_id: str
    status: str
    grade: Optional[float] = None
    override_prerequisite: bool = False
    override_reason: Optional[str] = None

class StudentProgress(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    subject_id: str
    status: str
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
    estimated_years_remaining: float
    gpa_by_quarter: List[dict]
    grade_distribution: List[dict]
    gpa_by_category: List[dict]
    available_subjects: List[dict]

# ============== HELPER FUNCTIONS ==============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, is_admin: bool = False) -> str:
    payload = {
        "sub": user_id,
        "is_admin": is_admin,
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

async def get_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

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
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(
        email=user_data.email,
        name=user_data.name,
        student_id=user_data.student_id,
        university_id=user_data.university_id,
        career_id=user_data.career_id,
        is_admin=False
    )
    
    user_dict = user.model_dump()
    user_dict["password"] = hash_password(user_data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Initialize progress for career subjects if career selected
    if user_data.career_id:
        subjects = await db.subjects.find({"career_id": user_data.career_id}, {"_id": 0}).to_list(200)
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
    
    token = create_token(user.id, user.is_admin)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id, email=user.email, name=user.name, 
            student_id=user.student_id, university_id=user.university_id,
            career_id=user.career_id, is_admin=user.is_admin
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user.get("is_admin", False))
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            student_id=user.get("student_id"),
            university_id=user.get("university_id"),
            career_id=user.get("career_id"),
            is_admin=user.get("is_admin", False)
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(**current_user)

@api_router.put("/auth/update-career")
async def update_user_career(
    university_id: str,
    career_id: str,
    current_user: dict = Depends(get_current_user)
):
    # Update user's university and career
    await db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"university_id": university_id, "career_id": career_id}}
    )
    
    # Delete old progress
    await db.student_progress.delete_many({"user_id": current_user["id"]})
    
    # Initialize progress for new career subjects
    subjects = await db.subjects.find({"career_id": career_id}, {"_id": 0}).to_list(200)
    for subject in subjects:
        progress = StudentProgress(
            user_id=current_user["id"],
            subject_id=subject["id"],
            status="pending"
        )
        progress_dict = progress.model_dump()
        progress_dict["created_at"] = progress_dict["created_at"].isoformat()
        progress_dict["updated_at"] = progress_dict["updated_at"].isoformat()
        await db.student_progress.insert_one(progress_dict)
    
    return {"success": True, "message": "Career updated successfully"}

# ============== UNIVERSITY ROUTES ==============

@api_router.get("/universities")
async def get_universities():
    universities = await db.universities.find({}, {"_id": 0}).to_list(100)
    return universities

@api_router.get("/universities/{university_id}")
async def get_university(university_id: str):
    university = await db.universities.find_one({"id": university_id}, {"_id": 0})
    if not university:
        raise HTTPException(status_code=404, detail="University not found")
    return university

@api_router.post("/admin/universities", response_model=dict)
async def create_university(data: UniversityCreate, admin: dict = Depends(get_admin_user)):
    university = University(**data.model_dump())
    uni_dict = university.model_dump()
    uni_dict["created_at"] = uni_dict["created_at"].isoformat()
    await db.universities.insert_one(uni_dict)
    return {"success": True, "university": uni_dict}

@api_router.put("/admin/universities/{university_id}")
async def update_university(university_id: str, data: UniversityCreate, admin: dict = Depends(get_admin_user)):
    result = await db.universities.update_one(
        {"id": university_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="University not found")
    return {"success": True}

@api_router.delete("/admin/universities/{university_id}")
async def delete_university(university_id: str, admin: dict = Depends(get_admin_user)):
    # Delete related careers and subjects
    careers = await db.careers.find({"university_id": university_id}, {"_id": 0}).to_list(100)
    for career in careers:
        await db.subjects.delete_many({"career_id": career["id"]})
    await db.careers.delete_many({"university_id": university_id})
    await db.universities.delete_one({"id": university_id})
    return {"success": True}

# ============== CAREER ROUTES ==============

@api_router.get("/careers")
async def get_careers(university_id: Optional[str] = None):
    query = {"university_id": university_id} if university_id else {}
    careers = await db.careers.find(query, {"_id": 0}).to_list(100)
    return careers

@api_router.get("/careers/{career_id}")
async def get_career(career_id: str):
    career = await db.careers.find_one({"id": career_id}, {"_id": 0})
    if not career:
        raise HTTPException(status_code=404, detail="Career not found")
    return career

@api_router.post("/admin/careers", response_model=dict)
async def create_career(data: CareerCreate, admin: dict = Depends(get_admin_user)):
    career = Career(**data.model_dump())
    career_dict = career.model_dump()
    career_dict["created_at"] = career_dict["created_at"].isoformat()
    await db.careers.insert_one(career_dict)
    return {"success": True, "career": career_dict}

@api_router.put("/admin/careers/{career_id}")
async def update_career(career_id: str, data: CareerCreate, admin: dict = Depends(get_admin_user)):
    result = await db.careers.update_one(
        {"id": career_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Career not found")
    return {"success": True}

@api_router.delete("/admin/careers/{career_id}")
async def delete_career(career_id: str, admin: dict = Depends(get_admin_user)):
    await db.subjects.delete_many({"career_id": career_id})
    await db.careers.delete_one({"id": career_id})
    return {"success": True}

# ============== SUBJECT ROUTES ==============

@api_router.get("/subjects")
async def get_subjects(career_id: Optional[str] = None):
    query = {"career_id": career_id} if career_id else {}
    subjects = await db.subjects.find(query, {"_id": 0}).to_list(200)
    return subjects

@api_router.get("/subjects/{subject_id}")
async def get_subject(subject_id: str):
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return subject

@api_router.post("/admin/subjects", response_model=dict)
async def create_subject(data: SubjectCreate, admin: dict = Depends(get_admin_user)):
    # Check if code already exists in this career
    existing = await db.subjects.find_one({"code": data.code, "career_id": data.career_id})
    if existing:
        raise HTTPException(status_code=400, detail="Subject code already exists in this career")
    
    subject = Subject(**data.model_dump())
    await db.subjects.insert_one(subject.model_dump())
    
    # Add to all users with this career
    users = await db.users.find({"career_id": data.career_id}, {"_id": 0}).to_list(1000)
    for user in users:
        progress = StudentProgress(
            user_id=user["id"],
            subject_id=subject.id,
            status="pending"
        )
        progress_dict = progress.model_dump()
        progress_dict["created_at"] = progress_dict["created_at"].isoformat()
        progress_dict["updated_at"] = progress_dict["updated_at"].isoformat()
        await db.student_progress.insert_one(progress_dict)
    
    return {"success": True, "subject": subject.model_dump()}

@api_router.put("/admin/subjects/{subject_id}")
async def update_subject(subject_id: str, data: SubjectCreate, admin: dict = Depends(get_admin_user)):
    result = await db.subjects.update_one(
        {"id": subject_id},
        {"$set": data.model_dump()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Subject not found")
    return {"success": True}

@api_router.delete("/admin/subjects/{subject_id}")
async def delete_subject(subject_id: str, admin: dict = Depends(get_admin_user)):
    await db.student_progress.delete_many({"subject_id": subject_id})
    await db.subjects.delete_one({"id": subject_id})
    return {"success": True}

# ============== PROGRESS ROUTES ==============

@api_router.get("/progress")
async def get_progress(current_user: dict = Depends(get_current_user)):
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(200)
    return progress_list

@api_router.get("/progress/detailed")
async def get_detailed_progress(current_user: dict = Depends(get_current_user)):
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]}, 
        {"_id": 0}
    ).to_list(200)
    
    career_id = current_user.get("career_id")
    if career_id:
        subjects = await db.subjects.find({"career_id": career_id}, {"_id": 0}).to_list(200)
    else:
        subjects = await db.subjects.find({}, {"_id": 0}).to_list(200)
    
    subjects_map = {s["id"]: s for s in subjects}
    
    detailed = []
    for p in progress_list:
        subject = subjects_map.get(p["subject_id"], {})
        detailed.append({**p, "subject": subject})
    
    return detailed

@api_router.put("/progress/{subject_id}")
async def update_progress(
    subject_id: str, 
    data: StudentProgressCreate,
    current_user: dict = Depends(get_current_user)
):
    subject = await db.subjects.find_one({"id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    if data.status in ["completed", "in_progress"] and not data.override_prerequisite:
        prereqs = subject.get("prerequisites", [])
        if prereqs:
            completed_progress = await db.student_progress.find(
                {"user_id": current_user["id"], "status": "completed"},
                {"_id": 0}
            ).to_list(200)
            completed_subject_ids = [p["subject_id"] for p in completed_progress]
            
            completed_subjects = await db.subjects.find(
                {"id": {"$in": completed_subject_ids}},
                {"_id": 0}
            ).to_list(200)
            completed_codes = [s["code"] for s in completed_subjects]
            
            missing = [p for p in prereqs if p not in completed_codes]
            if missing:
                return {
                    "error": "prerequisites_not_met",
                    "missing_prerequisites": missing,
                    "message": f"Esta materia requiere los siguientes prerrequisitos: {', '.join(missing)}"
                }
    
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
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(200)
    
    career_id = current_user.get("career_id")
    if career_id:
        subjects = await db.subjects.find({"career_id": career_id}, {"_id": 0}).to_list(200)
    else:
        subjects = await db.subjects.find({}, {"_id": 0}).to_list(200)
    
    subjects_map = {s["id"]: s for s in subjects}
    
    completed, in_progress, planned, pending = [], [], [], []
    
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
    
    total_points = 0
    total_credits_earned = 0
    
    for item in completed:
        if item.get("grade") is not None:
            credits = item["subject"]["credits"]
            gpa_points = calculate_gpa_points(item["grade"])
            total_points += gpa_points * credits
            total_credits_earned += credits
    
    gpa = total_points / total_credits_earned if total_credits_earned > 0 else 0.0
    
    total_credits = sum(s["credits"] for s in subjects)
    credits_remaining = total_credits - total_credits_earned
    
    progress_percentage = (total_credits_earned / total_credits * 100) if total_credits > 0 else 0
    
    # Calculate estimated years
    # Normal: 1 subject per month, but April and December allow 2 subjects
    # So per year: 10 months × 1 + 2 months × 2 = 14 subjects per year
    remaining_subjects = len(in_progress) + len(planned) + len(pending)
    subjects_per_year = 14  # 10 regular months + 2 double months (April, December)
    estimated_years = remaining_subjects / subjects_per_year if subjects_per_year > 0 else 0
    
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
    
    # Available subjects
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
        estimated_years_remaining=round(estimated_years, 1),
        gpa_by_quarter=gpa_by_quarter,
        grade_distribution=grade_distribution,
        gpa_by_category=gpa_by_category,
        available_subjects=available[:10]
    )

# ============== ADMIN STATS ==============

@api_router.get("/admin/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    universities_count = await db.universities.count_documents({})
    careers_count = await db.careers.count_documents({})
    subjects_count = await db.subjects.count_documents({})
    users_count = await db.users.count_documents({})
    
    return {
        "universities": universities_count,
        "careers": careers_count,
        "subjects": subjects_count,
        "users": users_count
    }

# ============== SEED DATA ==============

@api_router.post("/seed")
async def seed_database():
    existing_uni = await db.universities.find_one({"name": "Unicaribe"})
    if existing_uni:
        return {"message": "Database already seeded"}
    
    # Create Unicaribe university
    university = University(
        name="Unicaribe",
        country="República Dominicana"
    )
    uni_dict = university.model_dump()
    uni_dict["created_at"] = uni_dict["created_at"].isoformat()
    await db.universities.insert_one(uni_dict)
    
    # Create career
    career = Career(
        name="Ingeniería en Ciberseguridad",
        university_id=university.id,
        total_credits=185,
        duration_quarters=12,
        format="Cuatrimestral (1 materia por mes)"
    )
    career_dict = career.model_dump()
    career_dict["created_at"] = career_dict["created_at"].isoformat()
    await db.careers.insert_one(career_dict)
    
    # Subject data
    subjects_data = [
        {"code": "FGC-101", "name": "Orientación Académica Institucional", "credits": 2, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "FGC-102", "name": "Método del Trabajo Académico", "credits": 2, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "FGC-103", "name": "Metodología de la Investigación", "credits": 3, "quarter": 1, "prerequisites": [], "category": "Formación General"},
        {"code": "ADE-101", "name": "Administración I", "credits": 3, "quarter": 1, "prerequisites": [], "category": "Administración"},
        {"code": "FGC-104", "name": "Lengua Española I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-105", "name": "Matemática Básica I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Matemáticas"},
        {"code": "FGC-106", "name": "Tecnología de la Información y Comunicación I", "credits": 3, "quarter": 2, "prerequisites": ["FGC-102"], "category": "Tecnología"},
        {"code": "ING-101", "name": "Introducción a la Ingeniería", "credits": 3, "quarter": 2, "prerequisites": [], "category": "Ingeniería"},
        {"code": "FGC-107", "name": "Historia Social Dominicana", "credits": 3, "quarter": 3, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-108", "name": "Inglés I", "credits": 3, "quarter": 3, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "DMF-209", "name": "Física I", "credits": 4, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Ciencias"},
        {"code": "QUI-400", "name": "Química I", "credits": 3, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Ciencias"},
        {"code": "MTI-200", "name": "Matemática II", "credits": 4, "quarter": 3, "prerequisites": ["FGC-105"], "category": "Matemáticas"},
        {"code": "FGC-109", "name": "Filosofía", "credits": 2, "quarter": 4, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "FGC-110", "name": "Desarrollo Sostenible y Gestión de Riesgos", "credits": 2, "quarter": 4, "prerequisites": ["FGC-102"], "category": "Formación General"},
        {"code": "MTI-300", "name": "Matemática III", "credits": 4, "quarter": 4, "prerequisites": ["MTI-200"], "category": "Matemáticas"},
        {"code": "DMF-210", "name": "Física II", "credits": 4, "quarter": 4, "prerequisites": ["DMF-209"], "category": "Ciencias"},
        {"code": "MAT-241", "name": "Estadística I", "credits": 3, "quarter": 5, "prerequisites": ["FGC-105"], "category": "Matemáticas"},
        {"code": "ING-102", "name": "Ciencia e Ingeniería de Materiales", "credits": 4, "quarter": 5, "prerequisites": ["QUI-400"], "category": "Ingeniería"},
        {"code": "ING-103", "name": "Cálculo Integral", "credits": 4, "quarter": 5, "prerequisites": ["MTI-300"], "category": "Matemáticas"},
        {"code": "INF-215", "name": "Ingeniería Económica", "credits": 3, "quarter": 5, "prerequisites": ["MTI-200"], "category": "Ingeniería"},
        {"code": "MAT-242", "name": "Estadística II", "credits": 3, "quarter": 6, "prerequisites": ["MAT-241"], "category": "Matemáticas"},
        {"code": "ING-105", "name": "Taller de Mecánica de Hardware", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Tecnología"},
        {"code": "ING-104", "name": "Cálculo Vectorial", "credits": 4, "quarter": 6, "prerequisites": ["ING-103"], "category": "Matemáticas"},
        {"code": "INF-222", "name": "Sistema Operativo I", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Programación"},
        {"code": "INF-221", "name": "Introducción a la Programación", "credits": 3, "quarter": 6, "prerequisites": ["FGC-106"], "category": "Programación"},
        {"code": "TIC-408", "name": "Seguridad de la Información", "credits": 3, "quarter": 7, "prerequisites": ["FGC-106"], "category": "Seguridad"},
        {"code": "ISW-301", "name": "Taller de Programación I", "credits": 5, "quarter": 7, "prerequisites": ["INF-221"], "category": "Programación"},
        {"code": "INF-437", "name": "Redes Informáticas", "credits": 3, "quarter": 7, "prerequisites": ["INF-222"], "category": "Redes"},
        {"code": "ISW-321", "name": "Taller de Bases de Datos I", "credits": 4, "quarter": 7, "prerequisites": ["INF-221"], "category": "Programación"},
        {"code": "INR-215", "name": "Taller de Redes I", "credits": 4, "quarter": 8, "prerequisites": ["INF-437"], "category": "Redes"},
        {"code": "TIC-402", "name": "Ética en Tecnología", "credits": 2, "quarter": 8, "prerequisites": ["FGC-110"], "category": "Formación General"},
        {"code": "INC-404", "name": "Electiva I", "credits": 3, "quarter": 8, "prerequisites": [], "category": "Electiva"},
        {"code": "INC-222", "name": "Ciberdelitos, Ciberterrorismo, Ciberguerra", "credits": 3, "quarter": 8, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        {"code": "INC-231", "name": "Criptografía y Criptoanálisis", "credits": 3, "quarter": 9, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        {"code": "INC-315", "name": "Taller Seguridad de Redes y Telecomunicaciones", "credits": 4, "quarter": 9, "prerequisites": ["INR-215"], "category": "Seguridad"},
        {"code": "INC-325", "name": "Taller Seguridad de Sistemas Operativos y Software", "credits": 4, "quarter": 9, "prerequisites": ["INF-222"], "category": "Seguridad"},
        {"code": "INC-331", "name": "Sistema de Gestión de la Seguridad de la Información", "credits": 3, "quarter": 9, "prerequisites": ["TIC-408"], "category": "Seguridad"},
        {"code": "INC-332", "name": "Taller Seguridad de Bases de Datos", "credits": 4, "quarter": 9, "prerequisites": ["ISW-321"], "category": "Seguridad"},
        {"code": "INC-411", "name": "Gestión de Riesgos de la Seguridad de la Información", "credits": 3, "quarter": 10, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-333", "name": "Taller Seguridad de Infraestructura Física, Virtual y en la Nube", "credits": 4, "quarter": 10, "prerequisites": ["INC-315"], "category": "Seguridad"},
        {"code": "INC-405", "name": "Electiva II", "credits": 3, "quarter": 10, "prerequisites": [], "category": "Electiva"},
        {"code": "INC-401", "name": "Proyecto de Ciberseguridad - I", "credits": 5, "quarter": 10, "prerequisites": ["INC-331"], "category": "Proyecto"},
        {"code": "INC-403", "name": "Pasantía - Práctica de Ciberseguridad", "credits": 8, "quarter": 10, "prerequisites": ["INC-411"], "category": "Proyecto"},
        {"code": "INC-412", "name": "Marco Legal de la Seguridad de la Información", "credits": 3, "quarter": 11, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-413", "name": "Taller Seguridad en Dispositivos Móviles", "credits": 4, "quarter": 11, "prerequisites": ["INC-325"], "category": "Seguridad"},
        {"code": "INC-402", "name": "Proyecto de Ciberseguridad - II", "credits": 5, "quarter": 11, "prerequisites": ["INC-401"], "category": "Proyecto"},
        {"code": "INC-334", "name": "Ingeniería Social", "credits": 3, "quarter": 11, "prerequisites": ["INC-222"], "category": "Seguridad"},
        {"code": "FGC-111", "name": "Seminario de Grado", "credits": 3, "quarter": 11, "prerequisites": ["FGC-103"], "category": "Formación General"},
        {"code": "INC-414", "name": "Taller de Seguridad IoT y Entornos Industriales", "credits": 4, "quarter": 12, "prerequisites": ["INC-333"], "category": "Seguridad"},
        {"code": "INC-421", "name": "Análisis Forense en Ciberseguridad", "credits": 4, "quarter": 12, "prerequisites": ["INC-412"], "category": "Seguridad"},
        {"code": "INC-422", "name": "Taller de Auditoría de Seguridad de la Información", "credits": 4, "quarter": 12, "prerequisites": ["INC-331"], "category": "Seguridad"},
        {"code": "INC-600", "name": "Proyecto Integrador de Ciberseguridad: Trabajo de Grado", "credits": 6, "quarter": 12, "prerequisites": [], "category": "Proyecto"},
    ]
    
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
    
    # Create admin user
    admin_user = User(
        email="admin@uniprogress.com",
        name="Administrador",
        is_admin=True
    )
    admin_dict = admin_user.model_dump()
    admin_dict["password"] = hash_password("admin123")
    admin_dict["created_at"] = admin_dict["created_at"].isoformat()
    await db.users.insert_one(admin_dict)
    
    return {
        "message": "Database seeded successfully",
        "university_id": university.id,
        "career_id": career.id,
        "subjects_count": len(subjects_data),
        "admin_credentials": {"email": "admin@uniprogress.com", "password": "admin123"}
    }

# ============== REVIEW MODELS ==============

class SubjectReviewCreate(BaseModel):
    subject_id: str
    difficulty: int  # 1-5
    workload: int  # 1-5
    usefulness: int  # 1-5
    comment: Optional[str] = None
    tips: Optional[str] = None

class SubjectReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    subject_id: str
    difficulty: int
    workload: int
    usefulness: int
    comment: Optional[str] = None
    tips: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REVIEW ROUTES ==============

@api_router.get("/reviews/{subject_id}")
async def get_subject_reviews(subject_id: str):
    reviews = await db.subject_reviews.find(
        {"subject_id": subject_id}, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Calculate averages
    if reviews:
        avg_difficulty = sum(r["difficulty"] for r in reviews) / len(reviews)
        avg_workload = sum(r["workload"] for r in reviews) / len(reviews)
        avg_usefulness = sum(r["usefulness"] for r in reviews) / len(reviews)
    else:
        avg_difficulty = avg_workload = avg_usefulness = 0
    
    return {
        "reviews": reviews,
        "stats": {
            "count": len(reviews),
            "avg_difficulty": round(avg_difficulty, 1),
            "avg_workload": round(avg_workload, 1),
            "avg_usefulness": round(avg_usefulness, 1)
        }
    }

@api_router.post("/reviews")
async def create_review(data: SubjectReviewCreate, current_user: dict = Depends(get_current_user)):
    # Check if user already reviewed
    existing = await db.subject_reviews.find_one({
        "user_id": current_user["id"],
        "subject_id": data.subject_id
    })
    
    if existing:
        # Update existing review
        await db.subject_reviews.update_one(
            {"id": existing["id"]},
            {"$set": {
                "difficulty": data.difficulty,
                "workload": data.workload,
                "usefulness": data.usefulness,
                "comment": data.comment,
                "tips": data.tips,
                "created_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"success": True, "message": "Review updated"}
    
    review = SubjectReview(
        user_id=current_user["id"],
        user_name=current_user["name"],
        subject_id=data.subject_id,
        difficulty=data.difficulty,
        workload=data.workload,
        usefulness=data.usefulness,
        comment=data.comment,
        tips=data.tips
    )
    
    review_dict = review.model_dump()
    review_dict["created_at"] = review_dict["created_at"].isoformat()
    await db.subject_reviews.insert_one(review_dict)
    
    return {"success": True, "message": "Review created"}

@api_router.delete("/reviews/{review_id}")
async def delete_review(review_id: str, current_user: dict = Depends(get_current_user)):
    review = await db.subject_reviews.find_one({"id": review_id})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review["user_id"] != current_user["id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.subject_reviews.delete_one({"id": review_id})
    return {"success": True}

# ============== ALERTS/NOTIFICATIONS ==============

@api_router.get("/alerts")
async def get_alerts(current_user: dict = Depends(get_current_user)):
    alerts = []
    now = datetime.now(timezone.utc)
    current_month = now.month
    
    # Check if it's near registration periods (April or December)
    if current_month in [3, 4]:  # March-April
        alerts.append({
            "type": "registration",
            "title": "Período de Inscripción - Abril",
            "message": "En Abril puedes inscribir 2 materias. ¡Aprovecha para adelantar tu carrera!",
            "priority": "high",
            "icon": "calendar"
        })
    elif current_month in [11, 12]:  # November-December
        alerts.append({
            "type": "registration",
            "title": "Período de Inscripción - Diciembre",
            "message": "En Diciembre puedes inscribir 2 materias. ¡Planifica tu próximo período!",
            "priority": "high",
            "icon": "calendar"
        })
    
    # Check progress
    progress_list = await db.student_progress.find(
        {"user_id": current_user["id"]},
        {"_id": 0}
    ).to_list(200)
    
    in_progress_count = len([p for p in progress_list if p["status"] == "in_progress"])
    
    if in_progress_count == 0:
        alerts.append({
            "type": "progress",
            "title": "Sin Materias Activas",
            "message": "No tienes materias en curso. ¡Inscríbete en una materia para continuar tu progreso!",
            "priority": "medium",
            "icon": "warning"
        })
    
    # GPA alerts
    career_id = current_user.get("career_id")
    if career_id:
        subjects = await db.subjects.find({"career_id": career_id}, {"_id": 0}).to_list(200)
        subjects_map = {s["id"]: s for s in subjects}
        
        completed = [p for p in progress_list if p["status"] == "completed" and p.get("grade")]
        if completed:
            total_points = 0
            total_credits = 0
            for p in completed:
                subject = subjects_map.get(p["subject_id"])
                if subject:
                    grade = p["grade"]
                    gpa_points = 4.0 if grade >= 90 else 3.0 if grade >= 80 else 2.0 if grade >= 70 else 1.0 if grade >= 60 else 0.0
                    total_points += gpa_points * subject["credits"]
                    total_credits += subject["credits"]
            
            if total_credits > 0:
                gpa = total_points / total_credits
                if gpa >= 3.9:
                    alerts.append({
                        "type": "achievement",
                        "title": "¡Summa Cum Laude!",
                        "message": f"Tu GPA de {gpa:.2f} te coloca en el honor más alto. ¡Mantén el excelente trabajo!",
                        "priority": "low",
                        "icon": "trophy"
                    })
                elif gpa < 2.5:
                    alerts.append({
                        "type": "warning",
                        "title": "GPA en Riesgo",
                        "message": f"Tu GPA actual ({gpa:.2f}) está por debajo del promedio. Considera buscar tutorías o grupos de estudio.",
                        "priority": "high",
                        "icon": "alert"
                    })
    
    return alerts

# ============== ADMIN ANALYTICS ==============

@api_router.get("/admin/analytics")
async def get_admin_analytics(admin: dict = Depends(get_admin_user)):
    # Get all users with careers
    users = await db.users.find({"career_id": {"$ne": None}, "is_admin": {"$ne": True}}, {"_id": 0}).to_list(1000)
    
    if not users:
        return {
            "total_students": 0,
            "avg_gpa": 0,
            "completion_rate": 0,
            "students_by_career": [],
            "gpa_distribution": [],
            "top_performers": []
        }
    
    # Calculate stats per student
    student_stats = []
    for user in users:
        progress_list = await db.student_progress.find(
            {"user_id": user["id"]},
            {"_id": 0}
        ).to_list(200)
        
        if user.get("career_id"):
            subjects = await db.subjects.find({"career_id": user["career_id"]}, {"_id": 0}).to_list(200)
            subjects_map = {s["id"]: s for s in subjects}
            
            completed = [p for p in progress_list if p["status"] == "completed" and p.get("grade")]
            
            if completed:
                total_points = 0
                total_credits = 0
                for p in completed:
                    subject = subjects_map.get(p["subject_id"])
                    if subject:
                        grade = p["grade"]
                        gpa_points = 4.0 if grade >= 90 else 3.0 if grade >= 80 else 2.0 if grade >= 70 else 1.0 if grade >= 60 else 0.0
                        total_points += gpa_points * subject["credits"]
                        total_credits += subject["credits"]
                
                gpa = total_points / total_credits if total_credits > 0 else 0
                total_career_credits = sum(s["credits"] for s in subjects)
                completion = (total_credits / total_career_credits * 100) if total_career_credits > 0 else 0
                
                student_stats.append({
                    "user_id": user["id"],
                    "name": user["name"],
                    "career_id": user["career_id"],
                    "gpa": round(gpa, 2),
                    "credits_earned": total_credits,
                    "completion": round(completion, 1)
                })
    
    # Aggregate stats
    avg_gpa = sum(s["gpa"] for s in student_stats) / len(student_stats) if student_stats else 0
    avg_completion = sum(s["completion"] for s in student_stats) / len(student_stats) if student_stats else 0
    
    # Students by career
    careers = await db.careers.find({}, {"_id": 0}).to_list(100)
    career_names = {c["id"]: c["name"] for c in careers}
    
    students_by_career = {}
    for s in student_stats:
        career_name = career_names.get(s["career_id"], "Unknown")
        if career_name not in students_by_career:
            students_by_career[career_name] = {"count": 0, "total_gpa": 0}
        students_by_career[career_name]["count"] += 1
        students_by_career[career_name]["total_gpa"] += s["gpa"]
    
    students_by_career_list = [
        {
            "career": name,
            "students": data["count"],
            "avg_gpa": round(data["total_gpa"] / data["count"], 2) if data["count"] > 0 else 0
        }
        for name, data in students_by_career.items()
    ]
    
    # GPA distribution
    gpa_ranges = {"3.5-4.0": 0, "3.0-3.49": 0, "2.5-2.99": 0, "2.0-2.49": 0, "< 2.0": 0}
    for s in student_stats:
        if s["gpa"] >= 3.5:
            gpa_ranges["3.5-4.0"] += 1
        elif s["gpa"] >= 3.0:
            gpa_ranges["3.0-3.49"] += 1
        elif s["gpa"] >= 2.5:
            gpa_ranges["2.5-2.99"] += 1
        elif s["gpa"] >= 2.0:
            gpa_ranges["2.0-2.49"] += 1
        else:
            gpa_ranges["< 2.0"] += 1
    
    gpa_distribution = [{"range": k, "count": v} for k, v in gpa_ranges.items()]
    
    # Top performers
    top_performers = sorted(student_stats, key=lambda x: x["gpa"], reverse=True)[:10]
    
    return {
        "total_students": len(users),
        "avg_gpa": round(avg_gpa, 2),
        "completion_rate": round(avg_completion, 1),
        "students_by_career": students_by_career_list,
        "gpa_distribution": gpa_distribution,
        "top_performers": top_performers
    }

# ============== CSV IMPORT ==============

@api_router.post("/admin/import-subjects/{career_id}")
async def import_subjects_csv(career_id: str, subjects_data: List[SubjectCreate], admin: dict = Depends(get_admin_user)):
    """Import multiple subjects at once"""
    career = await db.careers.find_one({"id": career_id}, {"_id": 0})
    if not career:
        raise HTTPException(status_code=404, detail="Career not found")
    
    imported = 0
    errors = []
    
    for data in subjects_data:
        try:
            # Check if exists
            existing = await db.subjects.find_one({"code": data.code, "career_id": career_id})
            if existing:
                errors.append(f"{data.code}: Already exists")
                continue
            
            subject = Subject(
                code=data.code,
                name=data.name,
                credits=data.credits,
                quarter=data.quarter,
                career_id=career_id,
                prerequisites=data.prerequisites,
                category=data.category
            )
            await db.subjects.insert_one(subject.model_dump())
            imported += 1
        except Exception as e:
            errors.append(f"{data.code}: {str(e)}")
    
    return {
        "success": True,
        "imported": imported,
        "errors": errors
    }

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
    existing = await db.universities.find_one({})
    if not existing:
        logger.info("Seeding database...")
        await seed_database()
        logger.info("Database seeded!")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
