const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

exports.signUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    role: req.body.role,
  });

  const token = generateToken(newUser._id);

  res.status(200).json({
    status: 'success',
    token,
    data: {
      user: {
        name: newUser.name,
        email: newUser.email,
      },
    },
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || !password)
    return next(new AppError('Please Enter Email and Password', 400));

  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.checkPassword(password, user.password)))
    return next(new AppError('Incorrect email or password', 401));

  const token = generateToken(user._id);

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Token not defined please Log In!', 401));
  }

  const decodedToken = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET
  );

  const user = await User.findById(decodedToken.id);

  if (!user)
    return next(new AppError('User Does not exist for this Token', 401));

  if (user.changedPasswordAfter(decodedToken.iat)) {
    return next(
      new AppError('User Password Recently Changed Please re-login!', 401),
      401
    );
  }

  req.user = user;

  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Do not have permissions to perform this Action!', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  if (!req.body.email) {
    return next(new AppError('Please provide email', 400));
  }

  const user = await User.findOne({ email: req.body.email });

  if (!user)
    return next(new AppError('User with this email address Not Found!', 404));

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  const resetUrl = `${req.protocol}://${req.hostname}:3000/api/v1/users/resetPassword/${resetToken}`;

  const message = 'Click Here to Reset Password - ' + resetUrl;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Reset Link Natours Password (Expires in 10 Mins)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Reset Password Email Sent!',
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetTokenExpiresAt = undefined;
    await user.save({ validateBeforeSave: false });

    return next(new AppError('Email Cannot be Sent!', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedResetToken = crypto
    .createHash('sha256')
    .update(req.params.resetToken)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedResetToken,
    passwordResetTokenExpiresAt: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Reset Token Invalid or Expired!', 400));

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetTokenExpiresAt = undefined;
  await user.save();

  const token = generateToken(user._id);

  const message = `Hello ${user.name}, Your password was reset recently , if it was not you please reset immediately
          using this link - ${req.protocol}://${req.hostname}:3000/api/v1/users/forgotPassword Please use your address while resetting - ${user.email}`;

  try {
    await sendEmail({
      email: user.email,
      subject: '[Natours] Your password was reset',
      message,
    });
  } catch (err) {
    console.log('Password Change email was not sent Error!');
  }

  res.status(200).json({
    status: 'success',
    token,
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!req.body.password)
    return next(new AppError('Password is Required', 400));

  if (!(await user.checkPassword(req.body.password, user.password)))
    return next(new AppError('Incorrect Current Password!', 401));

  user.password = req.body.newPassword;
  user.confirmPassword = req.body.confirmPassword;
  await user.save();

  const token = generateToken(user._id);

  res.status(200).json({
    status: 'success',
    token,
    message: 'Password Successfully changed',
  });
});
