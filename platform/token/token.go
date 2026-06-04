package token

import(
	"time"
    "github.com/golang-jwt/jwt/v5"
    "os"
)

func GenerateToken(userID string)(string, error){
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":  time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))

	if err != nil{
		return "", err
	}

	return signedToken, nil
}