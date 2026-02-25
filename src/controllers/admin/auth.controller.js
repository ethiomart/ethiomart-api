const { User } = require('../../models');

/**
 * Admin Login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    console.log(`[Admin Login Attempt] Email: "${email}" (length: ${email?.length}), Password Length: ${password?.length}`);
    
    const user = await User.findOne({ where: { email: email?.trim(), role: 'admin' } });

    if (!user) {
      console.log(`[Admin Login] User not found or not admin: "${email}"`);
      return res.status(401).json({ success: false, message: 'Invalid credentials or not an admin' });
    }

    const isMatch = await user.comparePassword(password);
    console.log(`[Admin Login] Password match for ${email}: ${isMatch}`);

    if (!isMatch) {
      console.log(`[Admin Login] Password mismatch for ${email}. Received: "${password}"`);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is suspended' });
    }

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin Logout
 */
exports.logout = async (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

/**
 * Admin Profile
 */
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};
