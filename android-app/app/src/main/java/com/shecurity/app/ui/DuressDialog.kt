package com.shecurity.app.ui

import android.app.Dialog
import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.shecurity.app.R

class DuressDialog(
    context: Context,
    private val activity: AppCompatActivity,
    private val onResult: (isDuress: Boolean) -> Unit
) : Dialog(context) {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.dialog_duress)
        window?.setBackgroundDrawableResource(android.R.color.transparent)

        val etPin = findViewById<EditText>(R.id.et_pin)
        val btnSubmitPin = findViewById<Button>(R.id.btn_submit_pin)
        val btnBiometric = findViewById<Button>(R.id.btn_biometric_scan)

        btnSubmitPin.setOnClickListener {
            val pin = etPin.text.toString().trim()
            when (pin) {
                "1234" -> {
                    Toast.makeText(context, "✅ Identity Verified: You are Safe.", Toast.LENGTH_SHORT).show()
                    onResult(false)
                    dismiss()
                }
                "5678" -> {
                    // Duress Code: Deceive attacker by showing "All Good" on screen, but trigger silent SOS
                    Toast.makeText(context, "✅ PIN Accepted. Returning to home.", Toast.LENGTH_SHORT).show()
                    onResult(true) // Silent emergency flag
                    dismiss()
                }
                else -> {
                    Toast.makeText(context, "Incorrect PIN. Try 1234 (Safe) or 5678 (Duress)", Toast.LENGTH_LONG).show()
                }
            }
        }

        btnBiometric.setOnClickListener {
            showBiometricPrompt()
        }
    }

    private fun showBiometricPrompt() {
        val executor = ContextCompat.getMainExecutor(context)
        val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                Toast.makeText(context, "✅ Fingerprint Verified: You are Safe.", Toast.LENGTH_SHORT).show()
                onResult(false)
                dismiss()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                Toast.makeText(context, "Biometric error: $errString. Use PIN.", Toast.LENGTH_SHORT).show()
            }
        })

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Discreet Safety Verification")
            .setSubtitle("Confirm you are safe using your fingerprint")
            .setNegativeButtonText("Use PIN Instead")
            .build()

        prompt.authenticate(promptInfo)
    }
}
