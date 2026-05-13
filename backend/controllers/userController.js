const userRepo = require('../services/userRepository');
const teamRepo = require('../services/teamRepository');
const cognito = require('../services/cognitoService');
const { AppError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

async function listUsers(req, res, next) {
  try {
    const users = await userRepo.listUsers();
    res.json(users.map((u) => ({ ...u })));
  } catch (e) {
    next(e);
  }
}

async function listTeams(req, res, next) {
  try {
    const teams = await teamRepo.listTeams();
    res.json(teams);
  } catch (e) {
    next(e);
  }
}

async function createTeam(req, res, next) {
  try {
    const { name } = req.body || {};
    if (!name) throw new AppError('name is required');
    const teamId = uuidv4();
    const item = { teamId, name, createdAt: new Date().toISOString() };
    await teamRepo.createTeam(item);
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, temporaryPassword, name, role, teamId } = req.body || {};
    if (!email || !temporaryPassword || !role) {
      throw new AppError('email, temporaryPassword, and role are required');
    }
    if (role === 'EMPLOYEE' && !teamId) {
      throw new AppError('teamId required for employees');
    }
    const sub = await cognito.adminCreateUser({
      email,
      temporaryPassword,
      name: name || email,
    });
    await userRepo.createUser({
      userId: sub,
      email,
      name: name || email,
      role,
      teamId: role === 'EMPLOYEE' ? teamId : teamId || null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ userId: sub, email, role, teamId: teamId || null });
  } catch (e) {
    next(e);
  }
}

module.exports = { listUsers, listTeams, createTeam, createUser };
