package email

import (
	"fmt"
	"os"
	"stock-market-data-pipeline/internal/model"
	"github.com/resend/resend-go/v2"
)

func SendAlertEmail(toEmail string, n model.NotificationPayload) error{
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == ""{
		return fmt.Errorf("missing RESEND_API_KEY environment  variable")
	}

	fromEmail := os.Getenv("FROM_EMAIL")
	if fromEmail == ""{
		fromEmail = "onboarding@resend.dev"
	}

	client := resend.NewClient(apiKey)

	subjectString := fmt.Sprintf("🚨 MARKET TRIGGER: %s Has Crossed Threshold!", n.Ticker)
	
	htmlContent := fmt.Sprintf(`
		<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
			<h2 style="color: #e74c3c;">Stock Alert Fired!</h2>
			<p>Hello,</p>
			<p>Your custom price alert condition has successfully evaluated and matched against the live market pipeline stream.</p>
			<table style="border-collapse: collapse; width: 100%%; max-width: 400px; margin-top: 15px;">
				<tr style="background-color: #f8f9fa;">
					<td style="padding: 10px; border: 1px solid #ddd;"><strong>Ticker Asset:</strong></td>
					<td style="padding: 10px; border: 1px solid #ddd;">%s</td>
				</tr>
				<tr>
					<td style="padding: 10px; border: 1px solid #ddd;"><strong>Trigger Price:</strong></td>
					<td style="padding: 10px; border: 1px solid #ddd; color: #27ae60; font-weight: bold;">$%.2f</td>
				</tr>
				<tr style="background-color: #f8f9fa;">
					<td style="padding: 10px; border: 1px solid #ddd;"><strong>Timestamp:</strong></td>
					<td style="padding: 10px; border: 1px solid #ddd;">%s</td>
				</tr>
			</table>
			<br />
			<p style="font-size: 12px; color: #7f8c8d;">This specific target alert is now deactivated. If you want to continue tracking this threshold, please log into your dashboard and reactivate it.</p>
		</div>
	`, n.Ticker, n.PriceAtTrigger, n.TriggeredAt.Format("2006-01-02 15:04:05 MST"))

	params := &resend.SendEmailRequest{
		From: fromEmail,
		To :  []string{toEmail},
		Subject: subjectString,
		Html:  htmlContent,
	}

	_, err := client.Emails.Send(params)
	if err != nil{
		return fmt.Errorf("resend dispatch failed: %w", err)
	}

	return nil
}