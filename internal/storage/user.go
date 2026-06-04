package storage

import(
	"database/sql"
	"stock-market-data-pipeline/internal/model"
	"golang.org/x/crypto/bcrypt"
)

func CreateUser(db *sql.DB, req model.RegisterRequest)(*model.User, error){

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password),bcrypt.DefaultCost )
	if err != nil{
		return nil, err
	}

	query := `
		INSERT INTO users (full_name, email, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, full_name, email, created_at, updated_at
	`
	var user model.User

	err = db.QueryRow(query, req.FullName, req.Email, string(hashedPassword)).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil{
		return nil, err
	}

	return &user , nil
}

func GetUserByEmail(db *sql.DB, email string) (*model.User, string, error){
	query := `
		SELECT 	id, full_name, email, password_hash, created_at, updated_at
		FROM users
		WHERE email = $1
	`

	var user model.User
	var passwordHash string


	err := db.QueryRow(query, email).Scan(
		&user.ID,
		&user.FullName,
		&user.Email,
		&passwordHash,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	if err != nil{
		return nil, "", err
	}

	return &user, passwordHash, nil
}