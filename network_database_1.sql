-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 29, 2025 at 08:49 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `network_database`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_log`
--

CREATE TABLE `activity_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `target_identifier` varchar(255) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `activity_log`
--

INSERT INTO `activity_log` (`id`, `user_id`, `action`, `target_identifier`, `details`, `timestamp`) VALUES
(1, 1, 'CREATE_GROUP', '5556 - 5556', NULL, '2025-07-28 10:32:20'),
(2, 1, 'CREATE_DEVICE', '192.168.73.11777', 'Name: 777', '2025-07-28 10:32:40'),
(3, 1, 'UPDATE_DEVICE', '192.168.73.11', 'Updated device info. New IP: 192.168.73.11, Name: R125', '2025-07-28 10:33:07'),
(4, 1, 'CREATE_DEVICE', '192.168.73.11113', 'Name: sss', '2025-07-28 11:41:40'),
(5, 1, 'DELETE_DEVICE', '192.168.73.11777', NULL, '2025-07-28 12:18:11'),
(6, 1, 'UPDATE_DEVICE', '192.168.73.11', 'Updated device info. New IP: 192.168.73.11, Name: R125', '2025-07-28 16:02:44'),
(7, 1, 'UPDATE_DEVICE', '192.168.73.11', 'Updated device info. New IP: 192.168.73.11, Name: R125', '2025-07-28 16:19:13'),
(8, 1, 'UPDATE_DEVICE', '192.168.73.11113', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-28 16:19:45'),
(9, 1, 'CREATE_BACKUP', '192.168.73.200', 'เทส', '2025-07-29 13:32:51'),
(10, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.2003, Name: sss', '2025-07-29 13:33:59'),
(11, 1, 'UPDATE_DEVICE', '192.168.73.2003', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 13:53:30'),
(12, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 14:14:33'),
(13, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.200222, Name: sss', '2025-07-29 14:14:53'),
(14, 1, 'UPDATE_DEVICE', '192.168.73.200222', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:16:22'),
(15, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 14:16:35'),
(16, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.2003, Name: sss', '2025-07-29 14:17:13'),
(17, 1, 'UPDATE_DEVICE', '192.168.73.2003', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:17:27'),
(18, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.2003, Name: sss', '2025-07-29 14:29:50'),
(19, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 14:29:50'),
(20, 1, 'CREATE_GROUP', '66 - 66', NULL, '2025-07-29 14:30:22'),
(21, 1, 'CREATE_DEVICE', '666', 'Name: 66', '2025-07-29 14:30:36'),
(22, 1, 'UPDATE_DEVICE', '192.168.73.2003', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:31:58'),
(23, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:33:23'),
(24, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:33:28'),
(25, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.200, Name: sss', '2025-07-29 14:33:39'),
(26, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 15:17:36'),
(27, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 15:19:16'),
(28, 1, 'RESTORE_CONFIG', '192.168.73.200', 'Restored configuration from backup ID: 1', '2025-07-29 15:19:49'),
(30, 1, 'DB_DELETE_ROW', 'activity_log:29', NULL, '2025-07-29 15:53:58'),
(31, 1, 'UPDATE_DEVICE', '192.168.73.200', 'Updated device info. New IP: 192.168.73.200, Name: sss2', '2025-07-29 16:06:23'),
(32, 1, 'DB_UPDATE_ROW', 'device_groups:6', '{\'building_name\': \'66\', \'description\': \'66\', \'floor_name\': \'6612312\', \'loggedInUser\': \'admin\'}', '2025-07-29 16:34:45'),
(33, 1, 'DB_UPDATE_ROW', 'device_groups:6', '{\'building_name\': \'66\', \'description\': \'66\', \'floor_name\': \'1\', \'loggedInUser\': \'admin\'}', '2025-07-29 16:34:50'),
(34, 1, 'DB_UPDATE_ROW', 'device_groups:6', '{\'building_name\': \'66123\', \'description\': \'66\', \'floor_name\': \'1\', \'loggedInUser\': \'admin\'}', '2025-07-29 16:50:57'),
(35, 1, 'CREATE_BACKUP', '192.168.73.11', 'บันทึกข้อมูลล่าสุด', '2025-07-29 17:54:18'),
(36, 1, 'RESTORE_CONFIG', '192.168.73.11', 'Restored configuration from backup ID: 2', '2025-07-29 17:55:14');

-- --------------------------------------------------------

--
-- Table structure for table `config_backups`
--

CREATE TABLE `config_backups` (
  `id` int(11) NOT NULL,
  `device_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `configuration` longtext NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `config_backups`
--

INSERT INTO `config_backups` (`id`, `device_id`, `user_id`, `configuration`, `description`, `created_at`) VALUES
(1, 10, 1, 'Building configuration...\n\n  \nCurrent configuration : 1636 bytes\n!\n! Last configuration change at 19:50:48 UTC Tue Jul 29 2025\n!\nversion 15.2\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\nservice compress-config\n!\nhostname Sw\n!\nboot-start-marker\nboot-end-marker\n!\n!\n!\nusername admin privilege 15 secret 5 $1$9kdZ$.4SwWUr6qsZOzeMtnQ0rp0\nno aaa new-model\n!\n!\n!\n!\n!\n!\n!\n!\nno ip domain-lookup\nip domain-name mylab.local\nip cef\nno ipv6 cef\n!\n!\n!\nspanning-tree mode rapid-pvst\nspanning-tree extend system-id\n!\nvlan internal allocation policy ascending\n!\n! \n!\n!\n!\n!\n!\n!\n!\n!\n!\n!\n!\n!\ninterface Ethernet0/0\n!\ninterface Ethernet0/1\n!\ninterface Ethernet0/2\n!\ninterface Ethernet0/3\n!\ninterface Ethernet1/0\n!\ninterface Ethernet1/1\n!\ninterface Ethernet1/2\n!\ninterface Ethernet1/3\n!\ninterface Serial2/0\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial2/1\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial2/2\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial2/3\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial3/0\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial3/1\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial3/2\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Serial3/3\n no ip address\n shutdown\n serial restart-delay 0\n!\ninterface Vlan1\n ip address 192.168.73.200 255.255.255.0\n!\nip default-gateway 192.168.73.2\nip forward-protocol nd\n!\nno ip http server\nno ip http secure-server\n!\nip ssh version 2\n!\n!\n!\n!\n!\ncontrol-plane\n!\n!\nline con 0\n logging synchronous\nline aux 0\nline vty 0 4\n login local\n transport input ssh\n!\n!\nend\n', 'เทส', '2025-07-29 13:32:51'),
(2, 8, 1, 'Building configuration...\n\nCurrent configuration : 1458 bytes\n!\nversion 15.2\nservice config\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\n!\nhostname R11\n!\nboot-start-marker\nboot-end-marker\n!\n!\nenable secret 5 $1$BrWf$rVT6D5pWOim5Zk7qhWdO01\n!\nno aaa new-model\nmmi polling-interval 60\nno mmi auto-configure\nno mmi pvc\nmmi snmp-timeout 180\n!\n!\n!\n!\n\n\n!\n!\n!\n!\nip domain name mylab.local\nip cef\nno ipv6 cef\n!\nmultilink bundle-name authenticated\n!\n!\n!\n!\n!\n!\n!\n!\nusername admin privilege 15 secret 5 $1$NnKP$cinZvBFPxHLmitfCbg4ch/\n!\nredundancy\n!\n!\n! \n!\n!\n!\n!\n!\n!\n!\n!\n!\n!\n!\ninterface Ethernet0/0\n description To-Dashboard-Network\n ip address 192.168.73.11 255.255.255.0\n!\ninterface Ethernet0/1\n description Trunk-to-Sw\n no ip address\n!\ninterface Ethernet0/1.10\n encapsulation dot1Q 10\n ip address 192.168.10.1 255.255.255.0\n!\ninterface Ethernet0/1.20\n encapsulation dot1Q 20\n ip address 192.168.20.1 255.255.255.0\n!\ninterface Ethernet0/1.99\n encapsulation dot1Q 99\n ip address 192.168.99.1 255.255.255.0\n!\ninterface Ethernet0/2\n no ip address\n!\ninterface Ethernet0/2.10\n encapsulation dot1Q 10\n!\ninterface Ethernet0/2.20\n encapsulation dot1Q 20\n!\ninterface Ethernet0/2.99\n encapsulation dot1Q 99\n!\ninterface Ethernet0/3\n no ip address\n shutdown\n!\nip forward-protocol nd\n!\n!\nno ip http server\nno ip http secure-server\n!\n!\n!\n!\ncontrol-plane\n!\n!\n!\n!\n!\n!\n!\nline con 0\n logging synchronous\nline aux 0\nline vty 0 4\n password cisco\n login local\n transport input ssh\n!\n!\nend\n', 'บันทึกข้อมูลล่าสุด', '2025-07-29 17:54:18');

-- --------------------------------------------------------

--
-- Table structure for table `devices`
--

CREATE TABLE `devices` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `host` varchar(255) NOT NULL,
  `device_type` varchar(255) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `secret` varchar(255) DEFAULT NULL,
  `group_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `devices`
--

INSERT INTO `devices` (`id`, `name`, `category`, `host`, `device_type`, `username`, `password`, `secret`, `group_id`) VALUES
(8, 'R125', 'Routers', '192.168.73.11', 'cisco_ios', 'admin', 'cisco', '', 2),
(10, 'sss2', 'Switches', '192.168.73.200', 'cisco_ios', 'admin', 'cisco', 'cisco', 1),
(11, '66', 'Routers', '666', 'cisco_ios', 'admin', 'cisco', 'cisco', 6);

-- --------------------------------------------------------

--
-- Table structure for table `device_groups`
--

CREATE TABLE `device_groups` (
  `id` int(11) NOT NULL,
  `building_name` varchar(255) NOT NULL,
  `floor_name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `device_groups`
--

INSERT INTO `device_groups` (`id`, `building_name`, `floor_name`, `description`) VALUES
(1, '11', '11', '11'),
(2, '123123', '12321', '123123'),
(3, '555', '555', '555'),
(5, '5556', '5556', '555'),
(6, '66123', '1', '66');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `created_at`) VALUES
(1, 'admin', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', '2025-07-28 09:27:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_log`
--
ALTER TABLE `activity_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `config_backups`
--
ALTER TABLE `config_backups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `device_id` (`device_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `devices`
--
ALTER TABLE `devices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `host` (`host`),
  ADD KEY `group_id` (`group_id`);

--
-- Indexes for table `device_groups`
--
ALTER TABLE `device_groups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_group` (`building_name`,`floor_name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_log`
--
ALTER TABLE `activity_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=37;

--
-- AUTO_INCREMENT for table `config_backups`
--
ALTER TABLE `config_backups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `devices`
--
ALTER TABLE `devices`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `device_groups`
--
ALTER TABLE `device_groups`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_log`
--
ALTER TABLE `activity_log`
  ADD CONSTRAINT `activity_log_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `config_backups`
--
ALTER TABLE `config_backups`
  ADD CONSTRAINT `config_backups_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `config_backups_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `devices`
--
ALTER TABLE `devices`
  ADD CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `device_groups` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
