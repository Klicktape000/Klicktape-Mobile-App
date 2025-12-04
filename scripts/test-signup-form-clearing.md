# Signup Form Clearing Test Plan

## 🧪 Manual Testing Steps

### Test 1: Successful Signup with Form Clearing

**Setup:**
1. Navigate to the signup page
2. Fill out all form fields:
   - Email: `test@example.com`
   - Full Name: `Test User`
   - Password: `TestPassword123!`
   - Referral Code: `JOYINL559` (optional)
   - Check "Terms and Conditions"
   - Toggle password visibility to "visible"

**Expected Behavior:**
1. Submit the form
2. ✅ Loading spinner should appear
3. ✅ Success alert should show: "Account Created! Welcome to Klicktape! We've sent a verification email to test@example.com..."
4. ✅ After clicking "OK" on alert, form should be completely cleared:
   - Email field: Empty
   - Full Name field: Empty
   - Password field: Empty
   - Referral Code field: Empty
   - Terms checkbox: Unchecked
   - Password visibility: Hidden
   - No referral validation feedback visible

### Test 2: Successful Signup with Referral

**Setup:**
1. Navigate to signup page via referral link: `https://klicktape.com/invite/JOYINL559`
2. Verify referral code is pre-populated
3. Fill out remaining fields
4. Submit form

**Expected Behavior:**
1. ✅ Form should clear after successful signup
2. ✅ Referral welcome message should appear after main success alert
3. ✅ Form should be ready for new signup attempt

### Test 3: Signup Error (Form Should NOT Clear)

**Setup:**
1. Fill out form with invalid email: `invalid-email`
2. Submit form

**Expected Behavior:**
1. ✅ Error alert should show
2. ✅ Form should retain all entered data
3. ✅ User can correct the email and resubmit
4. ✅ Loading state should be reset

### Test 4: Validation Errors (Form Should NOT Clear)

**Setup:**
1. Leave required fields empty
2. Submit form

**Expected Behavior:**
1. ✅ Validation error alerts should show
2. ✅ Form should retain any entered data
3. ✅ Loading state should never be set (validation happens before loading)

## 🔍 Code Verification Points

### clearForm() Function
```typescript
const clearForm = () => {
  setEmail("");           // ✅ Email cleared
  setName("");            // ✅ Name cleared
  setPassword("");        // ✅ Password cleared
  setReferralCode("");    // ✅ Referral code cleared
  setReferralValidation({}); // ✅ Validation state cleared
  setShowPassword(false); // ✅ Password visibility reset
  setAcceptedTerms(false); // ✅ Terms checkbox unchecked
  setIsLoading(false);    // ✅ Loading state reset
};
```

### Form Clearing Timing
```typescript
if (data.user) {
  const userEmail = email; // ✅ Store email before clearing
  await handleReferralCompletion(data.user.id); // ✅ Handle referrals
  clearForm(); // ✅ Clear form immediately after success
  Alert.alert("Account Created!", `...${userEmail}...`); // ✅ Use stored email
}
```

### Error Handling
```typescript
} catch (error: any) {
  console.error("Signup error:", error);
  Alert.alert("Error", error.message || "An unexpected error occurred...");
  setIsLoading(false); // ✅ Only reset loading, keep form data
}
```

## 📱 User Experience Flow

1. **User fills form** → All fields populated
2. **User submits** → Loading spinner appears
3. **Signup succeeds** → Form immediately clears
4. **Success alert shows** → User sees confirmation with their email
5. **User clicks OK** → Redirected to sign-in page
6. **User navigates back** → Sees clean, empty form

## ✅ Success Criteria

- [ ] Form clears immediately after successful signup
- [ ] All input fields are empty after clearing
- [ ] All UI states are reset (password visibility, terms checkbox)
- [ ] All validation states are cleared
- [ ] Success message shows correct email (stored before clearing)
- [ ] Form does NOT clear on validation errors
- [ ] Form does NOT clear on signup errors
- [ ] Loading state is properly managed in all scenarios
- [ ] Referral completion works independently of form clearing
- [ ] Form is ready for immediate reuse after clearing

## 🐛 Common Issues to Watch For

1. **Email missing from success message** - Ensure email is stored before clearing
2. **Form not clearing on success** - Verify clearForm() is called after successful signup
3. **Form clearing on errors** - Ensure clearForm() is only called on success
4. **Loading state stuck** - Verify setIsLoading(false) in error cases
5. **Referral validation persisting** - Ensure setReferralValidation({}) clears all validation state

The form clearing implementation provides a professional, polished user experience that clearly indicates successful form submission while preserving data during error scenarios.
