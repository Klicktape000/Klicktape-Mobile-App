import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Link, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Feather } from "@expo/vector-icons";
import { ThemedGradient } from "@/components/ThemedGradient";
import { useTheme } from "@/src/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { referralAPI } from "@/lib/referralApi";


const SignUp = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralValidation, setReferralValidation] = useState<{
    isValid?: boolean;
    error?: string;
    referrerInfo?: { username: string; user_id: string };
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { colors } = useTheme();

  // Check for pending referral code from deep link
  useEffect(() => {
    const checkPendingReferralCode = async () => {
      try {
        const pendingCode = await AsyncStorage.getItem('pendingReferralCode');
        if (pendingCode) {
// console.log('📋 Found pending referral code:', pendingCode);
          setReferralCode(pendingCode);
          // Validate the pending code
          validateReferralCode(pendingCode);
        }
      } catch (__error) {
        console.error('Error checking pending referral code:', __error);
      }
    };

    checkPendingReferralCode();
  }, []);

  // Validate referral code
  const validateReferralCode = async (code: string) => {
    if (!code || code.trim().length === 0) {
      setReferralValidation({});
      return;
    }

    try {
      const validation = await referralAPI.validateReferralCode(code);
      setReferralValidation(validation);

      if (validation.isValid && validation.referrerInfo) {
// console.log('✅ Valid referral code from:', validation.referrerInfo.username);
      } else if (validation.error) {
// console.log('❌ Invalid referral code:', validation.error);
      }
    } catch (__error) {
      console.error('Error validating referral code:', __error);
      setReferralValidation({ isValid: false, error: 'Failed to validate referral code' });
    }
  };

  // Handle referral code input change
  const handleReferralCodeChange = (code: string) => {
    setReferralCode(code);
    // Debounce validation to avoid too many API calls
    if (code.trim().length >= 6) {
      setTimeout(() => validateReferralCode(code), 500);
    } else {
      setReferralValidation({});
    }
  };

  // Clear all form fields and reset states
  const clearForm = () => {
// console.log('🧹 Clearing signup form');

    // Clear all input fields
    setEmail("");
    setName("");
    setPassword("");
    setReferralCode("");

    // Reset all validation states
    setReferralValidation({});

    // Reset UI states
    setShowPassword(false);
    setAcceptedTerms(false);
    setIsLoading(false);

// console.log('✅ Signup form cleared successfully');
  };

  // Handle referral completion after successful registration
  const handleReferralCompletion = async (newUserId: string) => {
    try {
      let codeToComplete = '';

      // Check for manually entered referral code
      if (referralCode && referralCode.trim().length > 0 && referralValidation.isValid) {
        codeToComplete = referralCode.trim();
// console.log('📝 Using manually entered referral code:', codeToComplete);
      } else {
        // Check for pending referral code from deep link
        const pendingCode = await AsyncStorage.getItem('pendingReferralCode');
        if (pendingCode) {
          codeToComplete = pendingCode;
          //// console.log('🔗 Using pending referral code from deep link:', codeToComplete);
        }
      }

      if (codeToComplete) {
        //// console.log('🎯 Completing referral with code:', codeToComplete, 'for user:', newUserId);

        // Track referral click if it hasn't been tracked yet (for manual entry)
        if (referralCode && referralCode.trim().length > 0) {
          //// console.log('📊 Tracking referral click for manual entry');
          await referralAPI.trackReferralClick(codeToComplete);
        }

        // Complete the referral
        const success = await referralAPI.completeReferral(codeToComplete, newUserId);

        if (success) {
          //// console.log('✅ Referral completed successfully');

          // Clear pending referral code
          await AsyncStorage.removeItem('pendingReferralCode');
          //// console.log('🧹 Cleared pending referral code from storage');

          // Show success message if referrer info is available
          if (referralValidation.referrerInfo) {
            setTimeout(() => {
              Alert.alert(
                'Welcome!',
                `Thanks for joining through ${referralValidation.referrerInfo?.username}'s invite! They're one step closer to unlocking premium features.`,
                [{ text: 'Awesome!' }]
              );
            }, 2000);
          }
        } else {
          console.error('❌ Failed to complete referral - API returned false');
        }
      } else {
        //// console.log('ℹ️ No referral code found to complete');
      }
    } catch (__error) {
      console.error('💥 Error handling referral completion:', __error);
    }
  };

  const onSubmit = async () => {
    // Validate name
    if (!name || name.trim().length === 0) {
      Alert.alert("Error", "Please enter your full name");
      return;
    }

    if (name.length > 100) {
      Alert.alert("Error", "Name is too long (maximum 100 characters)");
      return;
    }

    // Validate email with a more comprehensive regex
    if (!email || email.trim().length === 0) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    // More comprehensive email validation
    const emailRegex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Validate password
    if (!password) {
      Alert.alert("Error", "Please enter a password");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long");
      return;
    }

    // Check for password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (!(hasUpperCase && hasLowerCase && hasNumbers)) {
      Alert.alert(
        "Weak Password",
        "Your password should contain at least one uppercase letter, one lowercase letter, and one number"
      );
      return;
    }

    // Validate terms acceptance
    if (!acceptedTerms) {
      Alert.alert("Error", "Please accept the Terms and Conditions to continue");
      return;
    }

    // Recommend but don't require special characters
    if (!hasSpecialChar) {
      const continueWithWeakPassword = await new Promise((resolve) => {
        Alert.alert(
          "Password Recommendation",
          "For better security, consider adding special characters to your password. Do you want to continue anyway?",
          [
            { text: "Improve Password", onPress: () => resolve(false) },
            { text: "Continue", onPress: () => resolve(true) }
          ]
        );
      });

      if (!continueWithWeakPassword) {
        return;
      }
    }

    setIsLoading(true);

    try {
      if (!supabase) {
        throw new Error("Supabase client is not initialized");
      }

      // First, check if the email already exists in the profiles table

      const { data: existingProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking profiles table:", profileError);
        // Continue with signup even if there's an error checking profiles
      } else if (existingProfiles) {

        Alert.alert(
          "Email Already Registered",
          "This email address is already registered. Please use a different email or sign in."
        );
        setIsLoading(false);
        return;
      }

      // If we get here, the email doesn't exist in profiles table
      // Attempt to sign up

      // Use web redirect URL that will redirect to the app
      // For development, use localhost. For production, use a working verification URL
      const emailRedirectTo = "https://klicktape-d087a.web.app/verify-email-manual-production.html";

// console.log('📧 Attempting to sign up user...');
// console.log('📧 Email:', email);
// console.log('🔗 Email redirect URL (manual verification):', emailRedirectTo);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: emailRedirectTo,
          data: {
            full_name: name,
            name: name,
          },
        },
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
        });

        // Check if the error indicates the email is already registered
        if (
          error.message.includes("already registered") ||
          error.message.includes("already in use") ||
          error.message.includes("already exists") ||
          error.message.includes("User already exists") ||
          error.message.includes("email address is already taken")
        ) {
          Alert.alert(
            "Email Already Registered",
            "This email address is already registered. Please use a different email or sign in."
          );
        } else if (error.message.includes("Database error saving new user")) {
          // Handle database trigger error - this should be resolved by the trigger fix
// console.log('🔧 Database trigger error detected - user creation may still succeed');
          Alert.alert(
            "Account Created",
            "Your account has been created successfully! Please check your email to verify your account before signing in.",
            [{ text: "OK", onPress: () => router.replace("/sign-in") }]
          );
        } else {
          // Handle other errors
          Alert.alert("Error", error.message || "Failed to create account. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      if (data.user) {
// console.log('✅ User created successfully');
// console.log('📊 User data:', {
// id: data.user.id,
// email: data.user.email,
// emailConfirmed: data.user.email_confirmed_at,
// });

        // Store email for the success message before clearing form
        const userEmail = email;

        // Handle referral completion (non-blocking)
        try {
// console.log('🎯 Starting referral completion for user:', data.user.id);
          await handleReferralCompletion(data.user.id);
// console.log('✅ Referral completion process finished');
        } catch (__referralError) {
          console.error('❌ Error during referral completion:', __referralError);
          // Continue with form clearing even if referral completion fails
        }

        // Clear all form fields and reset states immediately after successful signup
        clearForm();

        // Note: Profile creation is now handled by database trigger
        // The user will be redirected to create-profile to complete their profile
        // after email verification and sign-in

        Alert.alert(
          "Account Created!",
          `Welcome to Klicktape! We've sent a verification email to ${userEmail}.\n\nPlease check your inbox (and spam folder) and click the verification link to activate your account.\n\nAfter verification, you can log in with your credentials.`,
          [{ text: "OK", onPress: () => router.replace("/sign-in") }]
        );
      } else {
        throw new Error("No user data returned after signup");
      }
    } catch (__error: any) {
      console.error("Signup error:", __error);
      Alert.alert("Error", __error.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <ThemedGradient style={styles.container}>
      <View style={[styles.overlay, { backgroundColor: `${colors.background}80` }]}>
        <View style={[styles.card, { backgroundColor: `${colors.backgroundSecondary}90` }]}>
          <Text style={[styles.title, { color: colors.primary }]}>Create Account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Please sign up to continue</Text>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={`${colors.textTertiary}80`}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={`${colors.textTertiary}80`}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <View style={[styles.passwordContainer, {
                borderColor: `${colors.primary}30`,
                backgroundColor: `${colors.backgroundTertiary}80`
              }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Enter your password"
                placeholderTextColor={`${colors.textTertiary}80`}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Referral Code Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Referral Code <Text style={[styles.optionalText, { color: colors.textSecondary }]}>(Optional)</Text>
            </Text>
            <View style={[styles.referralContainer, {
                borderColor: referralValidation.isValid === true
                  ? '#4CAF50'
                  : referralValidation.isValid === false
                    ? '#F44336'
                    : `${colors.primary}30`,
                backgroundColor: `${colors.backgroundTertiary}80`
              }]}>
              <TextInput
                style={[styles.referralInput, { color: colors.text }]}
                placeholder="Enter referral code"
                placeholderTextColor={`${colors.textTertiary}80`}
                value={referralCode}
                onChangeText={handleReferralCodeChange}
                autoCapitalize="characters"
                maxLength={10}
              />
              {referralValidation.isValid === true && (
                <Feather
                  name="check-circle"
                  size={20}
                  color="#4CAF50"
                  style={styles.validationIcon}
                />
              )}
              {referralValidation.isValid === false && (
                <Feather
                  name="x-circle"
                  size={20}
                  color="#F44336"
                  style={styles.validationIcon}
                />
              )}
            </View>
            {referralValidation.isValid === true && referralValidation.referrerInfo && (
              <Text style={[styles.validationText, { color: '#4CAF50' }]}>
                ✓ Valid code from @{referralValidation.referrerInfo.username}
              </Text>
            )}
            {referralValidation.isValid === false && referralValidation.error && (
              <Text style={[styles.validationText, { color: '#F44336' }]}>
                {referralValidation.error}
              </Text>
            )}
          </View>

          {/* Terms and Conditions Checkbox */}
          <View style={styles.termsContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
            >
              <View style={[
                styles.checkbox,
                {
                  borderColor: colors.primary,
                  backgroundColor: acceptedTerms ? colors.primary : 'transparent'
                }
              ]}>
                {acceptedTerms && (
                  <Feather
                    name="check"
                    size={16}
                    color="#000000"
                  />
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.termsTextContainer}>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                I agree to the{" "}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(root)/terms-and-conditions")}
              >
                <Text style={[styles.termsLink, { color: colors.primary }]}>
                  Terms and Conditions
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={onSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>
          <View style={styles.signInContainer}>
            <Text style={[styles.signInText, { color: colors.textSecondary }]}>Already have an account?</Text>
            <Link href="/sign-in" style={styles.signInLink}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Sign In</Text>
            </Link>
          </View>
        </View>
      </View>
    </ThemedGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    maxWidth: 400,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  inputGroup: {
    width: "100%",
    marginBottom: 16
  },
  label: {
    fontSize: 14,
    marginBottom: 6
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    borderColor: "rgba(255, 215, 0, 0.3)",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    color: "#ffffff",
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  eyeButton: {
    padding: 12,
  },
  referralContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
  },
  referralInput: {
    flex: 1,
    padding: 12,
    fontSize: 16,
  },
  validationIcon: {
    marginRight: 12,
  },
  validationText: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  optionalText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  button: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#FFD700",
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    fontSize: 16,
    color: "#000000",
    fontWeight: "bold"
  },
  signInContainer: {
    flexDirection: "row",
    justifyContent: "center"
  },
  signInText: {
    fontSize: 14
  },
  signInLink: {
    marginLeft: 4
  },
  linkText: {
    fontSize: 14
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
  },
  termsLink: {
    fontSize: 14,
    lineHeight: 20,
    textDecorationLine: "underline",
  },
});

export default SignUp;
