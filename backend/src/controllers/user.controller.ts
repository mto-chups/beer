import { Request, Response } from 'express';
import {
  createUser,
  fetchAllUsers,
  removeUser,
  setUserTeam,
  updateUserData,
  User
} from '../services/user.service';

export const addUser = async (req: Request, res: Response) => {
  const { firstname, lastname, phone, weight, age, gender } = req.body;

  if (!firstname || !lastname) {
    return res.status(400).json({ message: "Prénom et nom requis" });
  }
  if (isNaN(Number(weight)) || Number(weight) <= 0) {
    return res.status(400).json({ message: "Poids invalide" });
  }
  if (!Number.isInteger(Number(age)) || Number(age) <= 0) {
    return res.status(400).json({ message: "Âge invalide" });
  }
  if (!['M','F'].includes(gender)) {
    return res.status(400).json({ message: "Genre invalide" });
  }

  try {
    const newUser: User = {
      firstname,
      lastname,
      phone: phone || null,
      weight: Number(weight),
      age: Number(age),
      gender,
      team_id: null
    };
    const id = await createUser(newUser);
    res.status(201).json({ message: "Utilisateur ajouté", id });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const getUsers = async (_: Request, res: Response) => {
  try {
    const users = await fetchAllUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  const id = req.params.id;
  try {
    await removeUser(Number(id));
    res.json({ message: "Utilisateur supprimé" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const updateUserTeam = async (req: Request, res: Response) => {
  const id = req.params.id;
  // ATTENTION : teamId peut être null OU un nombre
  const { teamId } = req.body;
  if (typeof teamId === "undefined") {
    return res.status(400).json({ message: "teamId requis" });
  }
  try {
    // Ici, tu passes bien null ou un id
    await setUserTeam(Number(id), teamId === null ? null : Number(teamId));
    res.json({ message: "Équipe assignée" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { firstname, lastname, phone, weight, age, gender } = req.body;

  if (!firstname || !lastname) {
    return res.status(400).json({ message: "Nom et prénom requis" });
  }
  if (isNaN(Number(weight)) || Number(weight) <= 0) {
    return res.status(400).json({ message: "Poids invalide" });
  }
  if (!Number.isInteger(Number(age)) || Number(age) <= 0) {
    return res.status(400).json({ message: "Âge invalide" });
  }
  if (!['M','F'].includes(gender)) {
    return res.status(400).json({ message: "Genre invalide" });
  }

  try {
    await updateUserData(
      id,
      firstname,
      lastname,
      phone || null,
      Number(weight),
      Number(age),
      gender
    );
    res.json({ message: "Utilisateur modifié" });
  } catch (err: any) {
    res.status(500).json({ message: err.message || "Erreur serveur" });
  }
};
