package token

import(
	"time"
    "github.com/golang-jwt/jwt/v5"
    "os"
	"errors"
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

func ValidateToken(tokenStr string) (string , error){

	token, err := jwt.Parse(tokenStr, func(token *jwt.Token)(interface{}, error){
		return []byte(os.Getenv("JWT_SECRET")), nil
	})

	if err != nil{
		return "", err
	}

	claims, ok := token.Claims.(jwt.MapClaims)

	if !ok || !token.Valid{
		return "", errors.New("invalid or expired token")
	}

	userID, exists := claims["user_id"].(string)
	if !exists {
		return "", errors.New("user_id not found in token claims")
	}
	return userID, nil
}