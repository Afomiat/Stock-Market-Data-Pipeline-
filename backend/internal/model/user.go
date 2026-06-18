package model

import(
	"time"
	"github.com/google/uuid"
)

type User struct{
	ID  uuid.UUID `json:"id"`
	FullName string `json:"full_name"`
	Email string `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

}

type RegisterRequest struct{
	FullName string `json:"full_name" binding:"required"`
	Email    string  `json:"email" binding:"required"`
	Password string  `json:"password" binding:"required"`
}

type LoginRequest struct{
	Email    string  `json:"email" binding:"required"`
	Password string  `json:"password" binding:"required"`
}

type LoginResponse struct{
	Token string `json:"token"`
	User  User   `json:"user"`
}