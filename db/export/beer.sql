-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost:3306
-- Généré le : dim. 23 août 2026 à 10:29
-- Version du serveur : 5.7.44
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `beer`
--

-- --------------------------------------------------------

--
-- Structure de la table `beers`
--

DROP TABLE IF EXISTS `beers`;
CREATE TABLE IF NOT EXISTS `beers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `brand` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `volume_ml` int(11) NOT NULL,
  `alcohol_degree` float NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `beers`
--

INSERT INTO `beers` (`id`, `brand`, `type`, `volume_ml`, `alcohol_degree`) VALUES
(1, 'Grimbergen', 'Blonde', 250, 5.48),
(3, 'Grimbergen', 'Blanche', 250, 5),
(4, 'Heineken', 'Blonde', 250, 0);

-- --------------------------------------------------------

--
-- Structure de la table `beer_bu`
--

DROP TABLE IF EXISTS `beer_bu`;
CREATE TABLE IF NOT EXISTS `beer_bu` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rfid_tag_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `drank_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `score` int(11) NOT NULL DEFAULT '1',
  `scan_id` varchar(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rfid_tag_id` (`rfid_tag_id`),
  UNIQUE KEY `ux_beer_bu_scan_id` (`scan_id`),
  KEY `fk_beerbu_user` (`user_id`)
) ENGINE=MyISAM AUTO_INCREMENT=87 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `beer_bu`
--

INSERT INTO `beer_bu` (`id`, `rfid_tag_id`, `user_id`, `drank_at`, `score`, `scan_id`) VALUES
(2, 1, 2, '2025-06-15 17:45:54', 1, NULL),
(8, 3, 5, '2025-06-10 17:45:54', 1, NULL),
(6, 2, 3, '2025-06-10 11:49:54', 1, NULL),
(7, 5, 2, '2025-06-10 12:09:34', 1, NULL),
(14, 10, 1, '2025-06-15 16:39:46', 1, NULL),
(15, 9, 1, '2025-06-15 16:39:52', 1, NULL),
(16, 8, 1, '2025-06-15 16:42:36', 1, NULL),
(17, 12, 1, '2025-06-15 16:52:08', 1, NULL),
(18, 11, 1, '2025-06-15 16:52:13', 1, NULL);

-- --------------------------------------------------------

--
-- Structure de la table `beer_events`
--

DROP TABLE IF EXISTS `beer_events`;
CREATE TABLE IF NOT EXISTS `beer_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(100) DEFAULT NULL,
  `brand` varchar(100) DEFAULT NULL,
  `type` varchar(100) DEFAULT NULL,
  `bonus_pts` int(11) DEFAULT '0',
  `multiplier` decimal(4,2) DEFAULT '1.00',
  `starts_at` datetime NOT NULL,
  `ends_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `beer_events`
--

INSERT INTO `beer_events` (`id`, `label`, `brand`, `type`, `bonus_pts`, `multiplier`, `starts_at`, `ends_at`) VALUES
(6, NULL, '', '', 0, 1.00, '2025-06-19 12:00:00', '2025-06-19 13:00:00'),
(7, NULL, 'Grimbergen', 'Blonde', 0, 3.00, '2025-06-19 10:03:00', '2025-06-19 11:03:00'),
(8, NULL, 'Grimbergen', 'Blonde', 15, 1.00, '2025-06-19 10:04:00', '2025-06-19 13:04:00');

-- --------------------------------------------------------

--
-- Structure de la table `kiosk_session`
--

DROP TABLE IF EXISTS `kiosk_session`;
CREATE TABLE IF NOT EXISTS `kiosk_session` (
  `kiosk_id` varchar(64) NOT NULL,
  `current_user_id` int(11) DEFAULT NULL,
  `motor_action` varchar(16) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`kiosk_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Structure de la table `manual_bonus`
--

DROP TABLE IF EXISTS `manual_bonus`;
CREATE TABLE IF NOT EXISTS `manual_bonus` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `team_id` int(11) NOT NULL,
  `points` int(11) NOT NULL,
  `reason` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `manual_bonus`
--

INSERT INTO `manual_bonus` (`id`, `team_id`, `points`, `reason`, `created_at`) VALUES
(1, 2, 10, 'Jeu 1 Gagné', '2025-06-10 16:58:54');

-- --------------------------------------------------------

--
-- Structure de la table `rfid_tags`
--

DROP TABLE IF EXISTS `rfid_tags`;
CREATE TABLE IF NOT EXISTS `rfid_tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `uid` varchar(64) NOT NULL,
  `beer_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_rfid_beer` (`beer_id`)
) ENGINE=MyISAM AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `rfid_tags`
--

INSERT INTO `rfid_tags` (`id`, `uid`, `beer_id`) VALUES
(1, '1', 1),
(2, 'xxxxxx', 3),
(3, '78', 4),
(5, 'U4', 3),
(17, 'E659A700', 3),
(7, '3', 3),
(11, 'FC1BF804', 1),
(12, 'B954F604', 3),
(13, '789', 3),
(14, '897', 3),
(15, '89', 3),
(19, '16', 3),
(18, '5A471705', 1);

-- --------------------------------------------------------

--
-- Structure de la table `scan_events`
--

DROP TABLE IF EXISTS `scan_events`;
CREATE TABLE IF NOT EXISTS `scan_events` (
  `scan_id` varchar(64) NOT NULL,
  `uid` varchar(255) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `rfid_tag_id` int(11) DEFAULT NULL,
  `status` enum('received','validated','committed','rejected','error') NOT NULL,
  `error_code` varchar(64) DEFAULT NULL,
  `error_message` varchar(255) DEFAULT NULL,
  `beer_bu_id` int(11) DEFAULT NULL,
  `score` int(11) DEFAULT NULL,
  `source` varchar(64) DEFAULT NULL,
  `scanned_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`scan_id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Structure de la table `teams`
--

DROP TABLE IF EXISTS `teams`;
CREATE TABLE IF NOT EXISTS `teams` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `teams`
--

INSERT INTO `teams` (`id`, `name`) VALUES
(1, 'Mitch\'s'),
(2, 'JeanDu29'),
(3, 'Levres');

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `team_id` int(11) DEFAULT NULL,
  `weight` decimal(5,2) DEFAULT NULL COMMENT 'Poids en kg',
  `age` int(11) DEFAULT NULL COMMENT 'Âge en années',
  `gender` enum('M','F') DEFAULT NULL COMMENT 'Genre : M ou F',
  PRIMARY KEY (`id`),
  KEY `fk_users_team` (`team_id`)
) ENGINE=MyISAM AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `first_name`, `last_name`, `phone`, `team_id`, `weight`, `age`, `gender`) VALUES
(1, 'Mathéo', 'CHUPIN', NULL, 1, 58.00, 23, 'M'),
(2, 'Salomé', 'Graton', NULL, 2, 50.00, 23, 'F'),
(3, 'Martin', 'Manceau', NULL, 2, 65.00, 24, 'M'),
(4, 'Florentin', 'Cognier', NULL, 1, 79.00, 24, 'M'),
(5, 'Jean', 'Jean', NULL, 3, 56.00, 45, 'M'),
(10, 'Jacquese', 'Attalie', 'e', NULL, 98.00, 65, 'F');
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
