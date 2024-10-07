use borsh::{BorshDeserialize, BorshSerialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use solana_program::entrypoint;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    clock::Clock,
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
};
use spl_associated_token_account::tools::account::create_pda_account;
use spl_token_2022::{instruction as token_instruction, state::Account, state::Mint};
use std::io::{Cursor, Read, Write};

// Define your program ID
solana_program::declare_id!("FY9aF1jszyGoABygvsQ28oHfqgyUVZkttzr8Vcx7sLKH");

// Constants
const AUTHORITY_PUBKEY: Pubkey =
    solana_program::pubkey!("3tXoH9Vy1Ah6UzmS4byEVdi7ouHvaARY5XWkyGtVHZm8");
const REQUIRED_STAKE_AMOUNT: u64 = 1_000 * 1_000_000_000; // 1000 tokens with 9 decimals

pub enum BullPosterError {
    InvalidCompetitionStatus,
    CompetitionFull,
    UserAlreadyEnrolled,
    InsufficientTokens,
    // Add more as needed
}

impl From<BullPosterError> for ProgramError {
    fn from(e: BullPosterError) -> Self {
        ProgramError::Custom(e as u32)
    }
}

// Instruction enum
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum BullPosterInstruction {
    InitializeProgram, // 1
    CreateRaidProgram {
        // 2
        name: String,
        description: String,
        profile_picture_url: String,
    },
    AuthorityMint {
        amount: u64,
    }, // 3
    CreateRaid {
        competition_type: String,
    }, // 4
    AcceptPVPRequest, // 5
    BurnTokens {
        burn_amount: u64,
    }, // 6
    EnrollInProgram,  // 7
    CreateUserCard,   // 8
    UpdateUserCard {
        // 9
        user_email: String,
        user_twitter_handle: String,
        user_dob: String,
        profile_picture_url: String,
    },
}

#[derive(BorshSerialize, Debug)]
pub struct ProgramStateCard {
    pub last_seen_raids: String, // JSON string with sequence number and competition id per competition type
    pub registered_programs_count: u64, // Number of registered programs
    pub registered_users_count: u64, // Number of registered users
}

impl ProgramStateCard {
    // Custom deserialization with logging to track the process
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        // Log the length of the input data (including extra space)
        msg!("Total data length: {} bytes", data.len());

        // Deserialize `last_seen_raids` (string field)
        let string_length =
            u32::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize string length: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        msg!("String length: {} bytes", string_length);

        cursor.set_position(cursor.position() + 4); // Move cursor past the length field

        let mut string_bytes = vec![0u8; string_length as usize];
        cursor.read_exact(&mut string_bytes).map_err(|e| {
            msg!("Failed to read string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        let last_seen_raids = String::from_utf8(string_bytes).map_err(|e| {
            msg!("Failed to convert string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        msg!("Deserialized `last_seen_raids`: {}", last_seen_raids);

        // Deserialize `registered_programs_count` (u64 field)
        let registered_programs_count = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize registered_programs_count: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        msg!(
            "Deserialized `registered_programs_count`: {}",
            registered_programs_count
        );

        cursor.set_position(cursor.position() + 8); // Move cursor past the u64 field

        // Deserialize `registered_users_count` (u64 field)
        let registered_users_count = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize registered_users_count: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        msg!(
            "Deserialized `registered_users_count`: {}",
            registered_users_count
        );

        // Log the cursor's position after deserialization
        let position = cursor.position();
        msg!("Cursor position after deserialization: {} bytes", position);

        // Confirm how much space is left
        msg!(
            "Unused space in account: {} bytes",
            data.len() - position as usize
        );

        // Return the deserialized struct
        Ok((
            ProgramStateCard {
                last_seen_raids,
                registered_programs_count,
                registered_users_count,
            },
            cursor.position() as usize,
        ))
    }

    // Custom serialization
    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        // Serialize last_seen_raids
        let last_seen_raids_bytes = self.last_seen_raids.as_bytes();
        (last_seen_raids_bytes.len() as u32)
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        cursor
            .write_all(last_seen_raids_bytes)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        // Serialize registered_programs_count
        self.registered_programs_count
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        // Serialize registered_users_count
        self.registered_users_count
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramRaidProgramsStateCard {
    pub raid_program_pubkeys: String, // Comma-separated list of raid program pubkeys
}

// ProgramRaidProgramsStateCard implementation
impl ProgramRaidProgramsStateCard {
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        msg!("Total data length: {} bytes", data.len());

        // Deserialize raid_program_pubkeys (string field)
        let string_length =
            u32::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize string length: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        msg!("String length: {} bytes", string_length);

        cursor.set_position(cursor.position() + 4); // Move cursor past the length field

        let mut string_bytes = vec![0u8; string_length as usize];
        cursor.read_exact(&mut string_bytes).map_err(|e| {
            msg!("Failed to read string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        let raid_program_pubkeys = String::from_utf8(string_bytes).map_err(|e| {
            msg!("Failed to convert string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        msg!(
            "Deserialized `raid_program_pubkeys`: {}",
            raid_program_pubkeys
        );

        let position = cursor.position();
        msg!("Cursor position after deserialization: {} bytes", position);
        msg!(
            "Unused space in account: {} bytes",
            data.len() - position as usize
        );

        Ok((
            Self {
                raid_program_pubkeys,
            },
            position as usize,
        ))
    }

    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        // Serialize raid_program_pubkeys
        let raid_program_pubkeys_bytes = self.raid_program_pubkeys.as_bytes();
        (raid_program_pubkeys_bytes.len() as u32)
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        cursor
            .write_all(raid_program_pubkeys_bytes)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramRaidsStateCard {
    pub raid_pubkeys: String, // Comma-separated list of raid pubkeys
}

impl ProgramRaidsStateCard {
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        // Deserialize raid_pubkeys (string field)
        let string_length =
            u32::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize string length: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        msg!("String length: {} bytes", string_length);

        cursor.set_position(cursor.position() + 4); // Move cursor past the length field

        let mut string_bytes = vec![0u8; string_length as usize];
        cursor.read_exact(&mut string_bytes).map_err(|e| {
            msg!("Failed to read string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        let raid_pubkeys = String::from_utf8(string_bytes).map_err(|e| {
            msg!("Failed to convert string data: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        msg!("Deserialized `raid_pubkeys`: {}", raid_pubkeys);

        let bytes_read = cursor.position() as usize;

        Ok((Self { raid_pubkeys }, bytes_read))
    }

    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        // Serialize raid_pubkeys
        let raid_pubkeys_bytes = self.raid_pubkeys.as_bytes();
        (raid_pubkeys_bytes.len() as u32)
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        cursor
            .write_all(raid_pubkeys_bytes)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramCompetitionsStateCard {
    pub competition_pubkeys: String, // Comma-separated list of competition card pubkeys
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct BurnCard {
    pub raid_program_id: Pubkey,
    pub competition_id: Pubkey,
    pub user_id: Pubkey,
    pub burn_amount: u64,
    pub timestamp: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct RaidCard {
    pub competition_id: Pubkey,
    pub raid_program_id: Pubkey,
    pub raid_id: Pubkey,
    pub distributed_rewards: String, // JSON string: { "user_pubkey": rewards, ... }
    pub placements: String,          // JSON string: ["1st_user_pubkey", "2nd_user_pubkey", ...]
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct CompetitionCard {
    pub competition_id: Pubkey,
    pub competition_type: String,
    pub start_time: u64,
    pub end_time: u64,
    pub total_rewards_distributed: u64,
    pub status: String,            // "awaiting", "active", "finalized", "expired"
    pub enrolled_programs: String, // Comma-separated list of raid IDs
    pub required_programs: u64,
    pub challenger_program_id: Option<Pubkey>,
    pub challenged_program_id: Option<Pubkey>,
    pub start_expiration: Option<u64>, // Only for PvP competitions
    pub distributed_rewards: String,   // JSON string: { "raid_pubkey": rewards, ... }
    pub placements: String,            // JSON string: ["1st_raid_pubkey", "2nd_raid_pubkey", ...]
}

impl CompetitionCard {
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        // Helper function for deserializing strings
        fn read_string(data: &[u8], cursor: &mut Cursor<&[u8]>) -> Result<String, ProgramError> {
            let string_length = u32::deserialize(&mut &data[cursor.position() as usize..])
                .map_err(|_| ProgramError::InvalidAccountData)?;
            cursor.set_position(cursor.position() + 4);
            let mut string_bytes = vec![0u8; string_length as usize];
            cursor
                .read_exact(&mut string_bytes)
                .map_err(|_| ProgramError::InvalidAccountData)?;
            String::from_utf8(string_bytes).map_err(|_| ProgramError::InvalidAccountData)
        }

        // Helper function for deserializing Pubkeys
        fn read_pubkey(data: &[u8], cursor: &mut Cursor<&[u8]>) -> Result<Pubkey, ProgramError> {
            let mut pubkey_bytes = [0u8; 32];
            cursor
                .read_exact(&mut pubkey_bytes)
                .map_err(|_| ProgramError::InvalidAccountData)?;
            Ok(Pubkey::new_from_array(pubkey_bytes))
        }

        let competition_id = read_pubkey(data, &mut cursor)?;
        let competition_type = read_string(data, &mut cursor)?;
        let start_time = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        cursor.set_position(cursor.position() + 8);
        let end_time = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        cursor.set_position(cursor.position() + 8);
        let total_rewards_distributed = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        cursor.set_position(cursor.position() + 8);
        let status = read_string(data, &mut cursor)?;
        let enrolled_programs = read_string(data, &mut cursor)?;
        let required_programs = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?;
        cursor.set_position(cursor.position() + 8);

        let challenger_program_id = if u8::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?
            != 0
        {
            cursor.set_position(cursor.position() + 1);
            Some(read_pubkey(data, &mut cursor)?)
        } else {
            cursor.set_position(cursor.position() + 1);
            None
        };

        let challenged_program_id = if u8::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?
            != 0
        {
            cursor.set_position(cursor.position() + 1);
            Some(read_pubkey(data, &mut cursor)?)
        } else {
            cursor.set_position(cursor.position() + 1);
            None
        };

        let start_expiration = if u8::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|_| ProgramError::InvalidAccountData)?
            != 0
        {
            cursor.set_position(cursor.position() + 1);
            Some(
                u64::deserialize(&mut &data[cursor.position() as usize..])
                    .map_err(|_| ProgramError::InvalidAccountData)?,
            )
        } else {
            cursor.set_position(cursor.position() + 1);
            None
        };
        if start_expiration.is_some() {
            cursor.set_position(cursor.position() + 8);
        }

        let distributed_rewards = read_string(data, &mut cursor)?;
        let placements = read_string(data, &mut cursor)?;

        let bytes_read = cursor.position() as usize;

        Ok((
            Self {
                competition_id,
                competition_type,
                start_time,
                end_time,
                total_rewards_distributed,
                status,
                enrolled_programs,
                required_programs,
                challenger_program_id,
                challenged_program_id,
                start_expiration,
                distributed_rewards,
                placements,
            },
            bytes_read,
        ))
    }

    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        // Helper function for serializing strings
        fn write_string(cursor: &mut Cursor<&mut [u8]>, s: &str) -> Result<(), ProgramError> {
            (s.len() as u32)
                .serialize(cursor)
                .map_err(|_| ProgramError::AccountDataTooSmall)?;
            cursor
                .write_all(s.as_bytes())
                .map_err(|_| ProgramError::AccountDataTooSmall)
        }

        // Helper function for serializing Pubkeys
        fn write_pubkey(
            cursor: &mut Cursor<&mut [u8]>,
            pubkey: &Pubkey,
        ) -> Result<(), ProgramError> {
            cursor
                .write_all(pubkey.as_ref())
                .map_err(|_| ProgramError::AccountDataTooSmall)
        }

        write_pubkey(&mut cursor, &self.competition_id)?;
        write_string(&mut cursor, &self.competition_type)?;
        self.start_time
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        self.end_time
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        self.total_rewards_distributed
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;
        write_string(&mut cursor, &self.status)?;
        write_string(&mut cursor, &self.enrolled_programs)?;
        self.required_programs
            .serialize(&mut cursor)
            .map_err(|_| ProgramError::AccountDataTooSmall)?;

        match &self.challenger_program_id {
            Some(pubkey) => {
                1u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
                write_pubkey(&mut cursor, pubkey)?;
            }
            None => {
                0u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
            }
        }

        match &self.challenged_program_id {
            Some(pubkey) => {
                1u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
                write_pubkey(&mut cursor, pubkey)?;
            }
            None => {
                0u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
            }
        }

        match self.start_expiration {
            Some(expiration) => {
                1u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
                expiration
                    .serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
            }
            None => {
                0u8.serialize(&mut cursor)
                    .map_err(|_| ProgramError::AccountDataTooSmall)?;
            }
        }

        write_string(&mut cursor, &self.distributed_rewards)?;
        write_string(&mut cursor, &self.placements)?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct RaidProgramCard {
    pub raid_program_id: Pubkey,
    pub name: String,
    pub description: String,
    pub user_key: Pubkey,
    pub profile_picture_url: String,
    pub pvp_requests: String, // Comma-separated list of PvP requests
    pub raids: String,        // Comma-separated list of Raid Pubkeys
    pub is_conducting_raid: bool,
    pub active_raid_id: Pubkey, // ID of the current raid
    pub size: u64,
    pub total_rewards_distributed: u64,
    pub total_raid_wins: u64,
    pub total_raids_partaken: u64,
    pub program_rank: u64, // New field for program's overall rank
}

impl RaidProgramCard {
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        let raid_program_id = Pubkey::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize raid_program_id: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 32); // Pubkey is 32 bytes

        let name = String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
            msg!("Failed to deserialize name: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        cursor.set_position(cursor.position() + 4 + name.len() as u64); // 4 bytes for length + string length

        let description =
            String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize description: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + description.len() as u64);

        let user_key =
            Pubkey::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize user_key: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 32);

        let profile_picture_url = String::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize profile_picture_url: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + profile_picture_url.len() as u64);

        let pvp_requests =
            String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize pvp_requests: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + pvp_requests.len() as u64);

        let raids = String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
            msg!("Failed to deserialize raids: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        cursor.set_position(cursor.position() + 4 + raids.len() as u64);

        let is_conducting_raid = bool::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize is_conducting_raid: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 1); // bool is 1 byte

        let active_raid_id = Pubkey::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize active_raid_id: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 32);

        let size = u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
            msg!("Failed to deserialize size: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        cursor.set_position(cursor.position() + 8); // u64 is 8 bytes

        let total_rewards_distributed = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize total_rewards_distributed: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let total_raid_wins =
            u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize total_raid_wins: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let total_raids_partaken = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize total_raids_partaken: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let program_rank =
            u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize program_rank: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let bytes_read = cursor.position() as usize;

        Ok((
            Self {
                raid_program_id,
                name,
                description,
                user_key,
                profile_picture_url,
                pvp_requests,
                raids,
                is_conducting_raid,
                active_raid_id,
                size,
                total_rewards_distributed,
                total_raid_wins,
                total_raids_partaken,
                program_rank,
            },
            bytes_read,
        ))
    }

    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        self.raid_program_id.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize raid_program_id: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.name.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize name: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.description.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize description: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.user_key.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize user_key: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.profile_picture_url
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize profile_picture_url: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.pvp_requests.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize pvp_requests: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.raids.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize raids: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.is_conducting_raid
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize is_conducting_raid: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.active_raid_id.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize active_raid_id: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.size.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize size: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.total_rewards_distributed
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize total_rewards_distributed: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.total_raid_wins.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize total_raid_wins: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.total_raids_partaken
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize total_raids_partaken: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.program_rank.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize program_rank: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct UserCard {
    pub user_pubkey: Pubkey,
    pub owned_programs: String, // Comma-separated list of owned program pubkeys
    pub enrolled_programs: String, // Comma-separated list of enrolled program pubkeys
    pub is_conducting_raid: bool,
    pub user_email: String,
    pub user_dob: String,
    pub user_twitter_handle: String,
    pub total_rewards: u64,
    pub participated_raids: u64,
    pub raid_ranking: u64,
    pub engagement_score: u64,
    pub streaks: u64,
    pub profile_picture_url: String,
}

impl UserCard {
    pub fn custom_deserialize(data: &[u8]) -> Result<(Self, usize), ProgramError> {
        let mut cursor = Cursor::new(data);

        let user_pubkey =
            Pubkey::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize user_pubkey: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 32); // Pubkey is 32 bytes

        let owned_programs = String::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize owned_programs: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + owned_programs.len() as u64); // 4 bytes for length + string length

        let enrolled_programs = String::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize enrolled_programs: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + enrolled_programs.len() as u64);

        let is_conducting_raid = bool::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize is_conducting_raid: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 1); // bool is 1 byte

        let user_email =
            String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize user_email: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + user_email.len() as u64);

        let user_dob =
            String::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize user_dob: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + user_dob.len() as u64);

        let user_twitter_handle = String::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize user_twitter_handle: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + user_twitter_handle.len() as u64);

        let total_rewards =
            u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize total_rewards: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8); // u64 is 8 bytes

        let participated_raids = u64::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize participated_raids: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let raid_ranking =
            u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize raid_ranking: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let engagement_score =
            u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
                msg!("Failed to deserialize engagement_score: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 8);

        let streaks = u64::deserialize(&mut &data[cursor.position() as usize..]).map_err(|e| {
            msg!("Failed to deserialize streaks: {:?}", e);
            ProgramError::InvalidAccountData
        })?;
        cursor.set_position(cursor.position() + 8);

        let profile_picture_url = String::deserialize(&mut &data[cursor.position() as usize..])
            .map_err(|e| {
                msg!("Failed to deserialize profile_picture_url: {:?}", e);
                ProgramError::InvalidAccountData
            })?;
        cursor.set_position(cursor.position() + 4 + profile_picture_url.len() as u64);

        let bytes_read = cursor.position() as usize;

        Ok((
            Self {
                user_pubkey,
                owned_programs,
                enrolled_programs,
                is_conducting_raid,
                user_email,
                user_dob,
                user_twitter_handle,
                total_rewards,
                participated_raids,
                raid_ranking,
                engagement_score,
                streaks,
                profile_picture_url,
            },
            bytes_read,
        ))
    }

    pub fn custom_serialize(&self, buffer: &mut [u8]) -> Result<usize, ProgramError> {
        let mut cursor = Cursor::new(buffer);

        self.user_pubkey.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize user_pubkey: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.owned_programs.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize owned_programs: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.enrolled_programs.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize enrolled_programs: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.is_conducting_raid
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize is_conducting_raid: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.user_email.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize user_email: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.user_dob.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize user_dob: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.user_twitter_handle
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize user_twitter_handle: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.total_rewards.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize total_rewards: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.participated_raids
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize participated_raids: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        self.raid_ranking.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize raid_ranking: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.engagement_score.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize engagement_score: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.streaks.serialize(&mut cursor).map_err(|e| {
            msg!("Failed to serialize streaks: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        self.profile_picture_url
            .serialize(&mut cursor)
            .map_err(|e| {
                msg!("Failed to serialize profile_picture_url: {:?}", e);
                ProgramError::AccountDataTooSmall
            })?;

        Ok(cursor.position() as usize)
    }
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct RaidHistory {
    pub history: String, // JSON string containing raid history
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct ProgramLeaderboardStateCard {
    pub leaderboard_data: String, // JSON string containing leaderboard data for all competition types
}

// Program entrypoint
#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Processing instruction");
    msg!("Instruction data length: {}", instruction_data.len());
    msg!("Instruction data: {:?}", instruction_data);

    if instruction_data.is_empty() {
        return Err(ProgramError::InvalidInstructionData);
    }

    let instruction_type = instruction_data[0];
    let instruction_body = &instruction_data[1..];

    match instruction_type {
        1 => {
            msg!("Instruction: Initialize Program");
            initialize_program(program_id, accounts)
        }
        2 => {
            msg!("Instruction: Create BullPoster Program");
            let (name, rest) = unpack_string(instruction_body)?;
            let (description, rest) = unpack_string(rest)?;
            let (profile_picture_url, _) = unpack_string(rest)?;

            msg!("Name: {}", name);
            msg!("Description: {}", description);
            msg!("Profile Picture URL: {}", profile_picture_url);

            initialize_raid_program(
                program_id,
                accounts,
                &name,
                description,
                profile_picture_url,
                REQUIRED_STAKE_AMOUNT,
            )
        }
        3 => {
            msg!("Instruction: Authority Transfer");
            if instruction_body.len() != 8 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let amount = u64::from_le_bytes(instruction_body.try_into().unwrap());
            authority_mint(program_id, accounts, amount)
        }
        4 => {
            msg!("Instruction: Create Raid");
            let (competition_type, _) = unpack_string(instruction_body)?;
            create_raid(program_id, accounts, competition_type)
        }
        5 => {
            msg!("Instruction: Accept PVP Request");
            accept_pvp_challenge(accounts)
        }
        6 => {
            msg!("Instruction: Burn Tokens");
            if instruction_body.len() != 8 {
                return Err(ProgramError::InvalidInstructionData);
            }
            let burn_amount = u64::from_le_bytes(instruction_body.try_into().unwrap());
            burn_tokens_for_raid(program_id, accounts, burn_amount)
        }
        7 => {
            msg!("Instruction: Enroll In Program");
            enroll_in_program(program_id, accounts)
        }
        8 => {
            msg!("Instruction: Create User Card");
            create_user_card(program_id, accounts)
        }
        9 => {
            msg!("Instruction: Update User Card");
            let (user_email, rest) = unpack_string(instruction_body)?;
            let (user_twitter_handle, rest) = unpack_string(rest)?;
            let (user_dob, rest) = unpack_string(rest)?;
            let (profile_picture_url, _) = unpack_string(rest)?;
            update_user_card(
                program_id,
                accounts,
                user_email,
                user_twitter_handle,
                user_dob,
                profile_picture_url,
            )
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn unpack_string(input: &[u8]) -> Result<(String, &[u8]), ProgramError> {
    if input.len() < 4 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let length = u32::from_le_bytes(input[..4].try_into().unwrap()) as usize;
    let start = 4;
    let end = start + length;

    if input.len() < end {
        return Err(ProgramError::InvalidInstructionData);
    }

    let string_bytes = &input[start..end];
    let string = String::from_utf8(string_bytes.to_vec())
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    Ok((string, &input[end..]))
}

fn initialize_program(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let initializer = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let state_account = next_account_info(account_info_iter)?;
    let program_raid_programs_state_account = next_account_info(account_info_iter)?;
    let program_raids_state_account = next_account_info(account_info_iter)?;
    let program_competitions_state_account = next_account_info(account_info_iter)?;
    let leaderboard_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let rent = next_account_info(account_info_iter)?;

    if initializer.key != &AUTHORITY_PUBKEY {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Derive PDA for token mint
    let (token_mint_pda, mint_bump) =
        Pubkey::find_program_address(&[b"pda_token_mint"], program_id);
    if token_mint_account.key != &token_mint_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Create token mint account as a PDA
    create_pda_account(
        initializer,
        &Rent::get()?,
        Mint::get_packed_len(),
        token_program.key,
        system_program,
        token_mint_account,
        &[b"pda_token_mint", &[mint_bump]],
    )?;

    // Initialize mint
    invoke_signed(
        &token_instruction::initialize_mint(
            token_program.key,
            &token_mint_pda,
            &token_mint_pda,
            Some(&token_mint_pda),
            9,
        )?,
        &[token_mint_account.clone(), rent.clone()],
        &[&[b"pda_token_mint", &[mint_bump]]],
    )?;

    // Derive PDA for program state
    let (state_account_pda, state_bump) =
        Pubkey::find_program_address(&[b"program_state"], program_id);
    if state_account.key != &state_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Calculate space needed for state account
    let state_data = ProgramStateCard {
        last_seen_raids: "{}".to_string(),
        registered_programs_count: 0,
        registered_users_count: 0,
    };

    let space = 1000;

    // Create program state account
    create_pda_account(
        initializer,
        &Rent::get()?,
        space,
        program_id,
        system_program,
        state_account,
        &[b"program_state", &[state_bump]],
    )?;

    // Initialize ProgramStateCard in the state account
    state_data.serialize(&mut &mut state_account.data.borrow_mut()[..])?;

    // Derive PDA for program raids state
    let (raid_programs_state_account_pda, state_bump) =
        Pubkey::find_program_address(&[b"program_raid_programs_state"], program_id);
    if program_raid_programs_state_account.key != &raid_programs_state_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Calculate space needed for program raids state account
    let raid_programs_state_data = ProgramRaidProgramsStateCard {
        raid_program_pubkeys: String::new(),
    };

    let raids_space = 1000;

    // Create program raids state account
    create_pda_account(
        initializer,
        &Rent::get()?,
        raids_space,
        program_id,
        system_program,
        program_raid_programs_state_account,
        &[b"program_raid_programs_state", &[state_bump]],
    )?;

    // Initialize ProgramStateCard in the state account
    raid_programs_state_data
        .serialize(&mut &mut program_raid_programs_state_account.data.borrow_mut()[..])?;

    // Derive PDA for program raids state
    let (raids_state_account_pda, state_bump) =
        Pubkey::find_program_address(&[b"program_raids_state"], program_id);
    if program_raids_state_account.key != &raids_state_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Calculate space needed for program raids state account
    let raids_state_data = ProgramRaidsStateCard {
        raid_pubkeys: String::new(),
    };

    let raids_space = 1000;

    // Create program raids state account
    create_pda_account(
        initializer,
        &Rent::get()?,
        raids_space,
        program_id,
        system_program,
        program_raids_state_account,
        &[b"program_raids_state", &[state_bump]],
    )?;

    // Initialize ProgramStateCard in the state account
    raids_state_data.serialize(&mut &mut program_raids_state_account.data.borrow_mut()[..])?;

    // Derive PDA for program competitions state
    let (competitions_state_account_pda, state_bump) =
        Pubkey::find_program_address(&[b"program_competitions_state"], program_id);
    if program_competitions_state_account.key != &competitions_state_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Calculate space needed for program competitions state account
    let competitions_state_data = ProgramCompetitionsStateCard {
        competition_pubkeys: String::new(),
    };

    let competitions_space = 1000;

    // Create program competitions account
    create_pda_account(
        initializer,
        &Rent::get()?,
        competitions_space,
        program_id,
        system_program,
        program_competitions_state_account,
        &[b"program_competitions_state", &[state_bump]],
    )?;

    // Initialize ProgramStateCard in the state account
    competitions_state_data
        .serialize(&mut &mut program_competitions_state_account.data.borrow_mut()[..])?;

    // Derive PDA for program leaderboard state
    let (leaderboard_state_account_pda, state_bump) =
        Pubkey::find_program_address(&[b"program_leaderboard_state"], program_id);
    if leaderboard_account.key != &leaderboard_state_account_pda {
        return Err(ProgramError::InvalidAccountData.into());
    }

    // Calculate space needed for program leaderboard state account
    let leaderboard_state_data = ProgramLeaderboardStateCard {
        leaderboard_data: "{}".to_string(),
    };

    let leaderboard_space = 1000;

    // Create program leaderboard account
    create_pda_account(
        initializer,
        &Rent::get()?,
        leaderboard_space,
        program_id,
        system_program,
        leaderboard_account,
        &[b"program_leaderboard_state", &[state_bump]],
    )?;

    // Initialize ProgramStateCard in the state account
    leaderboard_state_data.serialize(&mut &mut leaderboard_account.data.borrow_mut()[..])?;

    msg!("Token mint and program state initialized");
    Ok(())
}

pub fn initialize_raid_program(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    program_name: &str,
    description: String,
    profile_picture_url: String,
    stake_amount: u64,
) -> ProgramResult {
    msg!("Entering initialize_raid_program");

    // Input validation
    if program_name.len() > 32 || description.len() > 256 || profile_picture_url.len() > 128 {
        msg!("Error: Input strings exceed maximum allowed length");
        return Err(ProgramError::InvalidArgument);
    }

    msg!(
        "Program name: {}, length: {}",
        program_name,
        program_name.len()
    );
    msg!("Description length: {}", description.len());
    msg!("Profile picture URL length: {}", profile_picture_url.len());
    msg!("Stake amount: {}", stake_amount);

    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_token_account = next_account_info(account_info_iter)?;
    let raid_program_data_account = next_account_info(account_info_iter)?;
    let raid_program_token_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_raid_programs_state_account = next_account_info(account_info_iter)?;
    let user_card_account = next_account_info(account_info_iter)?;
    let token_mint_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let rent = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program state account
    let (program_state_pda, _) = Pubkey::find_program_address(&[b"program_state"], program_id);
    if program_state_account.key != &program_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify program raid programs state account
    let (program_raid_programs_state_pda, _) =
        Pubkey::find_program_address(&[b"program_raid_programs_state"], program_id);
    if program_raid_programs_state_account.key != &program_raid_programs_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Derive PDA for user card account
    let user_card_seed = format!("user_card_{}", user_account.key.to_string());
    let mut hasher = Sha256::new();
    hasher.update(user_card_seed.as_bytes());
    let result = hasher.finalize();
    let seed = &result[..32];

    let (user_card_pda, bump) = Pubkey::find_program_address(&[seed], program_id);

    if user_card_account.key != &user_card_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Generate the seed using SHA-256 and take the first 32 bytes
    let seed_string = format!(
        "raid_program_{}_{}",
        user_account.key.to_string(),
        program_name
    );
    let mut hasher = Sha256::new();
    hasher.update(seed_string.as_bytes());
    let result = hasher.finalize();
    let seed = &result[..32];

    // Use the hash as the seed
    let (raid_program_data_account_pda, bump) = Pubkey::find_program_address(&[&seed], program_id);

    // Verify provided Raid Program Account matches derived PDA
    if raid_program_data_account.key != &raid_program_data_account_pda {
        msg!("Error: Raid Program Account does not match derived PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if account already exists
    if !raid_program_data_account.data_is_empty() {
        msg!("Raid Program Account is not empty");
        // verify account data is of the correct type
        return Err(ProgramError::InvalidAccountData);
    } else {
        // Account doesn't exist, create and initialize it
        // Create program account
        let raid_program_space = RaidProgramCard {
            raid_program_id: raid_program_data_account.key.clone(),
            name: program_name.to_string(),
            description: description.clone(),
            user_key: *user_account.key,
            profile_picture_url: profile_picture_url.clone(),
            pvp_requests: String::new(),
            raids: String::new(),
            is_conducting_raid: false,
            active_raid_id: Pubkey::default(),
            size: 0,
            total_rewards_distributed: 0,
            total_raid_wins: 0,
            total_raids_partaken: 0,
            program_rank: 0,
        };

        let space = 1000;
        msg!("RaidProgramCard created, serialized size: {} bytes", space);

        // let lamports = Rent::get()?.minimum_balance(space);

        msg!("Creating Raid Program PDA account...");
        create_pda_account(
            user_account,              // The user initiating the transaction
            &Rent::get()?,             // Required lamports for rent-exemption
            space,                     // Size of the account to be created
            program_id,                // Token program associated with this action
            system_program,            // System program for creating the account
            raid_program_data_account, // The PDA account for the raid program
            &[&result, &[bump]],       // Seeds for generating PDA and the bump seed
        )?;

        msg!("Serializing RaidProgramCard to Raid Program account...");
        raid_program_space.serialize(&mut &mut raid_program_data_account.data.borrow_mut()[..])?;

        // Generate the seed using SHA-256 and take the first 32 bytes
        let raid_program_token_account_seed_string = format!(
            "raid_program_token_account_{}",
            raid_program_data_account.key.to_string()
        );
        let mut hasher = Sha256::new();
        hasher.update(raid_program_token_account_seed_string.as_bytes());
        let result = hasher.finalize();
        let raid_program_token_account_seed = &result[..32];

        // Derive PDA for the token account
        let (raid_program_token_account_pda, token_account_bump) =
            Pubkey::find_program_address(&[raid_program_token_account_seed], program_id);

        msg!("Creating Raid Program token account...");
        // Create the token account
        create_pda_account(
            user_account,
            &Rent::get()?,
            Account::LEN,
            token_program.key,
            system_program,
            raid_program_token_account, // This should be the token account, not the raid program account
            &[&raid_program_token_account_seed, &[token_account_bump]],
        )?;

        msg!("Initializing Raid Program token account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,
                raid_program_token_account.key, // Removed & here
                token_mint_account.key,         // Removed & here
                &raid_program_token_account_pda,
            )?,
            &[
                raid_program_token_account.clone(),
                token_mint_account.clone(),
                rent.clone(), // Added rent account
            ],
            &[&[raid_program_token_account_seed, &[token_account_bump]]],
        )?;
    }

    // Transfer tokens from user to Raid Program account
    msg!(
        "Transferring {} tokens to Raid Program account",
        stake_amount
    );
    invoke(
        &token_instruction::transfer(
            token_program.key,              // Token program ID
            user_token_account.key,         // User's token account (source of tokens)
            raid_program_token_account.key, // Destination: the raid program account
            user_account.key,               // User account (payer and authority)
            &[],                            // No additional signers
            stake_amount,                   // Amount of tokens to transfer
        )?,
        &[
            user_token_account.clone(),         // Source account for the tokens
            raid_program_token_account.clone(), // Destination account (raid program PDA)
            user_account.clone(),               // Authority account of the user
            token_program.clone(),              // Token program involved in the transfer
        ],
    )?;

    // Deserialize ProgramStateCard from account data using custom_deserialize
    let (mut program_state, bytes_read) = ProgramStateCard::custom_deserialize(
        &program_state_account.data.borrow(),
    )
    .map_err(|e| {
        msg!("Failed to deserialize ProgramStateCard: {:?}", e);
        ProgramError::InvalidAccountData
    })?;

    let total_space = program_state_account.data.borrow().len();

    // Modify the program state
    msg!("Current ProgramStateCard: {:?}", program_state);
    program_state.registered_programs_count += 1;
    msg!("Updated ProgramStateCard: {:?}", program_state);

    // Serialize the updated data to a temporary buffer
    let mut temp_buffer = vec![0u8; total_space];
    let bytes_written = program_state
        .custom_serialize(&mut temp_buffer)
        .map_err(|e| {
            msg!("Failed to serialize updated ProgramStateCard: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

    msg!("Bytes written during serialization: {}", bytes_written);

    if bytes_written > total_space {
        msg!(
            "Error: New data size ({} bytes) exceeds total account space ({} bytes)",
            bytes_written,
            total_space
        );
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Now we can mutably borrow the account data and update it
    let mut account_data = program_state_account.data.borrow_mut();
    account_data[..bytes_written].copy_from_slice(&temp_buffer[..bytes_written]);

    // Handle both scenarios: new data smaller or larger than old data
    if bytes_written < bytes_read {
        // New data is smaller: clear unused space
        msg!("New data is smaller. Clearing unused space.");
        account_data[bytes_written..bytes_read].fill(0);
        let new_unused_space = total_space - bytes_written;
        msg!("New unused space: {} bytes", new_unused_space);
        msg!(
            "Additional unused space created: {} bytes",
            bytes_read - bytes_written
        );
    } else if bytes_written > bytes_read {
        // New data is larger: using some of the empty space
        msg!("New data is larger. Using some empty space.");
        let space_used = bytes_written - bytes_read;
        msg!(
            "Additional space used from empty space: {} bytes",
            space_used
        );
        let new_unused_space = total_space - bytes_written;
        msg!("Remaining unused space: {} bytes", new_unused_space);
    } else {
        // Data size unchanged
        msg!("Data size unchanged.");
    }

    msg!("Successfully updated ProgramStateCard");

    // For ProgramRaidProgramsStateCard
    let (mut raid_programs_state, raid_programs_bytes_read) =
        ProgramRaidProgramsStateCard::custom_deserialize(
            &program_raid_programs_state_account.data.borrow(),
        )
        .map_err(|e| {
            msg!(
                "Failed to deserialize ProgramRaidProgramsStateCard: {:?}",
                e
            );
            ProgramError::InvalidAccountData
        })?;

    msg!(
        "Current ProgramRaidProgramsStateCard: {:?}",
        raid_programs_state
    );
    raid_programs_state
        .raid_program_pubkeys
        .push_str(&raid_program_data_account.key.to_string());
    raid_programs_state.raid_program_pubkeys.push(',');
    msg!(
        "Updated ProgramRaidProgramsStateCard: {:?}",
        raid_programs_state
    );

    // Serialize the updated ProgramRaidProgramsStateCard
    let mut data = program_raid_programs_state_account.data.borrow_mut();
    let bytes_written = raid_programs_state
        .custom_serialize(&mut data)
        .map_err(|e| {
            msg!(
                "Failed to serialize updated ProgramRaidProgramsStateCard: {:?}",
                e
            );
            ProgramError::AccountDataTooSmall
        })?;

    // Handle potential size changes
    if bytes_written > raid_programs_bytes_read {
        msg!(
            "New ProgramRaidProgramsStateCard data is larger. Using {} bytes of empty space.",
            bytes_written - raid_programs_bytes_read
        );
    } else if bytes_written < raid_programs_bytes_read {
        msg!(
            "New ProgramRaidProgramsStateCard data is smaller. Clearing {} bytes of unused space.",
            raid_programs_bytes_read - bytes_written
        );
        data[bytes_written..raid_programs_bytes_read].fill(0);
    }

    // For UserCard
    let (mut user_card, user_card_bytes_read) =
        UserCard::custom_deserialize(&user_card_account.data.borrow()).map_err(|e| {
            msg!("Failed to deserialize UserCard: {:?}", e);
            ProgramError::InvalidAccountData
        })?;

    msg!("Current UserCard: {:?}", user_card);
    user_card
        .owned_programs
        .push_str(&raid_program_data_account.key.to_string());
    user_card.owned_programs.push(',');
    msg!("Updated UserCard: {:?}", user_card);

    // Serialize the updated UserCard
    let mut data = user_card_account.data.borrow_mut();
    let bytes_written = user_card.custom_serialize(&mut data).map_err(|e| {
        msg!("Failed to serialize updated UserCard: {:?}", e);
        ProgramError::AccountDataTooSmall
    })?;

    // Handle potential size changes
    if bytes_written > user_card_bytes_read {
        msg!(
            "New UserCard data is larger. Using {} bytes of empty space.",
            bytes_written - user_card_bytes_read
        );
    } else if bytes_written < user_card_bytes_read {
        msg!(
            "New UserCard data is smaller. Clearing {} bytes of unused space.",
            user_card_bytes_read - bytes_written
        );
        data[bytes_written..user_card_bytes_read].fill(0);
    }

    msg!("BullPoster Raid Program initialized successfully");
    msg!(
        "Raid Program Data account: {:?}",
        raid_program_data_account.key
    );
    msg!(
        "Raid Program Token account: {:?}",
        raid_program_token_account.key
    );
    msg!("Staked amount: {}", stake_amount);

    Ok(())
}

fn burn_tokens_for_raid(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    burn_amount: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?; // User's main account (signer)
    let user_card_account = next_account_info(account_info_iter)?; // User's card account
    let burn_card_account = next_account_info(account_info_iter)?; // Account to store burn information
    let token_program = next_account_info(account_info_iter)?; // SPL Token program
    let token_mint_account = next_account_info(account_info_iter)?; // Token mint account
    let system_program = next_account_info(account_info_iter)?; // System program
    let rent = next_account_info(account_info_iter)?; // Rent sysvar
    let raid_program_account = next_account_info(account_info_iter)?; // Account storing raid program data
    let competition_account = next_account_info(account_info_iter)?; // Account storing competition data

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Obtain raid program id
    let raid_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&raid_program_account.data.borrow())?;
    let raid_program_id = raid_program_data.raid_program_id;

    // Obtain competition card data and verify that raid id is inclunded in enrolled programs
    let competition_data: CompetitionCard =
        CompetitionCard::try_from_slice(&competition_account.data.borrow())?;
    let enrolled_programs: Vec<&str> = competition_data.enrolled_programs.split(',').collect();
    if !enrolled_programs.contains(&raid_program_id.to_string().as_str()) {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify competition card account is active and has not been completed
    if competition_data.status != "active" {
        return Err(ProgramError::InvalidAccountData);
    }

    // If active verify not past end time
    if Clock::get()?.unix_timestamp as u64 >= competition_data.end_time {
        return Err(ProgramError::InvalidAccountData);
    }

    let user_card_data: UserCard = UserCard::try_from_slice(&user_card_account.data.borrow())?;
    if user_card_data.user_pubkey != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }
    if !user_card_data
        .enrolled_programs
        .contains(&raid_program_id.to_string())
    {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify that burn card account is not initialized (empty)
    if !burn_card_account.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Derive PDA for burn account
    let burn_seed = format!(
        "burn_{}_{}_{}",
        user_account.key,
        raid_program_id,
        Clock::get()?.unix_timestamp as u64
    );
    let (burn_card_account_pda, bump) =
        Pubkey::find_program_address(&[burn_seed.as_bytes()], program_id);

    // Verify that the provided burn_card_account matches the derived PDA
    if burn_card_account.key != &burn_card_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create burn card account
    let burn_space = BurnCard {
        raid_program_id: raid_program_id.clone(),
        competition_id: competition_data.competition_id.clone(),
        user_id: *user_account.key,
        burn_amount,
        timestamp: Clock::get()?.unix_timestamp as u64,
    };

    let space = 1000;

    // let lamports = Rent::get()?.minimum_balance(space);

    create_pda_account(
        user_account,                     // Payer for account creation
        &Rent::get()?,                    // Lamports for rent exemption
        space,                            // Size of the account
        token_program.key,                // Owner of the new account
        system_program,                   // System program for creating account
        burn_card_account,                // The account being created
        &[burn_seed.as_bytes(), &[bump]], // PDA seeds
    )?;

    // Initialize the burn card account
    invoke_signed(
        &token_instruction::initialize_account3(
            token_program.key,      // Token program ID
            burn_card_account.key,  // Account to initialize
            token_mint_account.key, // Mint of the token
            &burn_card_account_pda, // Authority of the account
        )?,
        &[
            burn_card_account.clone(),
            token_mint_account.clone(),
            burn_card_account.clone(),
            rent.clone(),
        ],
        &[&[burn_seed.as_bytes(), &[bump]]],
    )?;

    // Transfer tokens from user to burn account
    msg!("Transferring {} tokens to burn account", burn_amount);
    invoke(
        &token_instruction::transfer(
            token_program.key,     // Token program ID
            user_account.key,      // User's token account (source)
            burn_card_account.key, // Burn card account (destination)
            user_account.key,      // User's account (payer and authority)
            &[],                   // No additional signers
            burn_amount,           // Amount of tokens to transfer to burn account
        )?,
        &[
            user_account.clone(),      // User's token account (source of tokens)
            burn_card_account.clone(), // Burn card account (destination)
            user_account.clone(),      // User's account (authority)
            token_program.clone(),     // Token program for managing token operations
        ],
    )?;

    // Burn tokens
    msg!("Burning {} tokens", burn_amount);
    invoke_signed(
        &token_instruction::burn(
            token_program.key,      // Token program ID
            burn_card_account.key,  // Burn card account (from where the tokens are burned)
            &burn_card_account_pda, // PDA that has authority over the burn account
            user_account.key,       // User's account (authority for burn action)
            &[],                    // No additional signers
            burn_amount,            // Amount of tokens to burn
        )?,
        &[
            burn_card_account.clone(), // Burn card account (source of tokens to burn)
            burn_card_account.clone(), // PDA of the burn card account
            user_account.clone(),      // User's account (authority)
            token_program.clone(),     // Token program managing the burn operation
        ],
        &[&[burn_seed.as_bytes(), &[bump]]],
    )?;
    // Store burn data

    let burn_data = BurnCard {
        raid_program_id: raid_program_id.clone(),
        competition_id: competition_data.competition_id.clone(),
        user_id: *user_account.key,
        burn_amount,
        timestamp: Clock::get()?.unix_timestamp as u64,
    };
    burn_data.serialize(&mut &mut burn_card_account.data.borrow_mut()[..])?;

    msg!("Tokens burned successfully");
    Ok(())
}

fn create_raid(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    competition_type: String,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let current_competition_account = next_account_info(account_info_iter)?;
    let new_competition_account = next_account_info(account_info_iter)?;
    let raid_program_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let current_raid_card_account = next_account_info(account_info_iter)?;
    let new_raid_card_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let program_raids_state_account = next_account_info(account_info_iter)?;
    let program_competitions_state_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program state account
    let (program_state_pda, _) = Pubkey::find_program_address(&[b"program_state"], program_id);
    if program_state_account.key != &program_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify program raids state account
    let (program_raids_state_pda, _) =
        Pubkey::find_program_address(&[b"program_raids_state"], program_id);
    if program_raids_state_account.key != &program_raids_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Verify program competitions state account
    let (program_competitions_state_pda, _) =
        Pubkey::find_program_address(&[b"program_competitions_state"], program_id);
    if program_competitions_state_account.key != &program_competitions_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Deserialize ProgramStateCard from account data using custom_deserialize
    let mut data_slice = &program_state_account.data.borrow()[..];
    let initial_len = data_slice.len();

    let (mut program_state, state_bytes_read) = ProgramStateCard::custom_deserialize(
        &program_state_account.data.borrow(),
    )
    .map_err(|e| {
        msg!("Failed to deserialize ProgramStateCard: {:?}", e);
        ProgramError::InvalidAccountData
    })?;

    // Log cursor position (how many bytes were read)
    let cursor_position = initial_len - data_slice.len();
    msg!("Cursor position after deserialization: {}", cursor_position);

    // Calculate and log unused space in the account
    let unused_space = program_state_account.data.borrow().len() - cursor_position;
    msg!(
        "Unused space in account after deserialization: {}",
        unused_space
    );

    // Fetch and update sequence number for competition type from `last_seen_raids`
    let mut last_seen_raids: serde_json::Value =
        serde_json::from_str(&program_state.last_seen_raids).unwrap_or_else(|_| json!({}));

    let current_sequence = last_seen_raids[&competition_type]
        .get("sequence")
        .and_then(|s| s.as_u64())
        .unwrap_or(0);

    let new_sequence = current_sequence + 1;

    // Verify program ownership and update raid status if necessary
    let (mut raid_program_data, raid_program_bytes_read) =
        RaidProgramCard::custom_deserialize(&raid_program_account.data.borrow())?;
    if raid_program_data.user_key != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Handle competition creation or joining
    let (competition_account, is_new_competition, raid_card_account) = if competition_type == "PvP"
    {
        let challenged_program_account = next_account_info(account_info_iter)?;

        if challenged_program_account.key == raid_program_account.key {
            return Err(ProgramError::InvalidAccountData);
        }

        let competition_seed = format!(
            "{}_{}_{}_{}",
            raid_program_account.key.to_string(),
            competition_type,
            new_sequence,
            challenged_program_account.key.to_string(),
        );
        let mut hasher = Sha256::new();
        hasher.update(competition_seed.as_bytes());
        let result = hasher.finalize();
        let hashed_seed = &result[..32];

        last_seen_raids[&competition_type] = json!({
            "sequence": new_sequence,
            "competition_id": hashed_seed,
        });

        create_new_competition(
            program_id,
            &[
                user_account.clone(),
                system_program.clone(),
                new_competition_account.clone(),
                program_competitions_state_account.clone(),
            ],
            new_sequence,
            &competition_type,
            Some(raid_program_account.key.clone()),
            Some(challenged_program_account.key.clone()),
        )?;

        (new_competition_account, true, new_raid_card_account)
    } else {
        let competition_data: CompetitionCard =
            CompetitionCard::try_from_slice(&current_competition_account.data.borrow())?;

        if current_competition_account.data_is_empty()
            || competition_data.status != "awaiting"
            || competition_data.enrolled_programs.split(',').count() as u64
                >= competition_data.required_programs
        {
            let competition_seed = format!("{}_{}", competition_type, new_sequence);
            let mut hasher = Sha256::new();
            hasher.update(competition_seed.as_bytes());
            let result = hasher.finalize();
            let hashed_seed = &result[..32];

            last_seen_raids[&competition_type] = json!({
                "sequence": new_sequence,
                "competition_id": hashed_seed,
            });

            create_new_competition(
                program_id,
                &[
                    user_account.clone(),
                    system_program.clone(),
                    new_competition_account.clone(),
                    program_competitions_state_account.clone(),
                ],
                new_sequence,
                &competition_type,
                None,
                None,
            )?;

            (new_competition_account, true, new_raid_card_account)
        } else {
            (
                current_competition_account,
                false,
                current_raid_card_account,
            )
        }
    };

    if is_new_competition {
        // Update ProgramStateCard
        program_state.last_seen_raids = serde_json::to_string(&last_seen_raids).unwrap();

        // Serialize the updated ProgramStateCard
        let mut data = program_state_account.data.borrow_mut();
        let bytes_written = program_state.custom_serialize(&mut data).map_err(|e| {
            msg!("Failed to serialize updated ProgramStateCard: {:?}", e);
            ProgramError::AccountDataTooSmall
        })?;

        // Handle potential size changes
        if bytes_written > state_bytes_read {
            msg!(
                "New ProgramStateCard data is larger. Using {} bytes of empty space.",
                bytes_written - state_bytes_read
            );
        } else if bytes_written < state_bytes_read {
            msg!(
                "New ProgramStateCard data is smaller. Clearing {} bytes of unused space.",
                state_bytes_read - bytes_written
            );
            data[bytes_written..state_bytes_read].fill(0);
        }

        msg!("New competition created successfully");
    } else {
        // Verify that the current competition account exists
        if current_competition_account.data_is_empty() {
            return Err(ProgramError::UninitializedAccount);
        }

        let (mut competition_data, comp_bytes_read) =
            CompetitionCard::custom_deserialize(&competition_account.data.borrow())?;
        competition_data
            .enrolled_programs
            .push_str(&format!("{},", raid_program_account.key.to_string()));

        if competition_data.enrolled_programs.split(',').count() as u64
            >= competition_data.required_programs
        {
            competition_data.status = "active".to_string();
            competition_data.start_time = Clock::get()?.unix_timestamp as u64 + 300; // 5 minutes from now
            competition_data.end_time = competition_data.start_time + 1200; // End in 20 minutes after start
        }

        let mut data = competition_account.data.borrow_mut();
        let bytes_written = competition_data.custom_serialize(&mut data)?;

        // Handle potential size changes
        if bytes_written > comp_bytes_read {
            msg!(
                "New CompetitionCard data is larger. Using {} bytes of empty space.",
                bytes_written - comp_bytes_read
            );
        } else if bytes_written < comp_bytes_read {
            msg!(
                "New CompetitionCard data is smaller. Clearing {} bytes of unused space.",
                comp_bytes_read - bytes_written
            );
            data[bytes_written..comp_bytes_read].fill(0);
        }

        msg!("Joined existing competition successfully");
    }

    // Create raid account
    let raid_seed = format!(
        "raid_{}_{}",
        competition_account.key.to_string(),
        raid_program_account.key.to_string()
    );

    let mut hasher = Sha256::new();
    hasher.update(raid_seed.as_bytes());
    let result = hasher.finalize();
    let hashed_raid_seed = &result[..32];

    let (raid_account_pda, bump) = Pubkey::find_program_address(&[&hashed_raid_seed], program_id);

    // Verify that the provided raid_card_account matches the derived PDA
    if raid_card_account.key != &raid_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the raid card account already exists
    if !raid_card_account.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let raid_space = RaidCard {
        competition_id: competition_account.key.clone(),
        raid_program_id: raid_program_account.key.clone(),
        raid_id: raid_card_account.key.clone(),
        distributed_rewards: String::new(),
        placements: String::new(),
    };

    let space = 1000;

    create_pda_account(
        user_account,
        &Rent::get()?,
        space,
        program_id,
        system_program,
        raid_card_account,
        &[&hashed_raid_seed, &[bump]],
    )?;

    raid_space.serialize(&mut &mut raid_card_account.data.borrow_mut()[..])?;

    // Update RaidProgramCard
    let (mut raid_program_data, raid_prog_bytes_read) =
        RaidProgramCard::custom_deserialize(&raid_program_account.data.borrow())?;
    raid_program_data.is_conducting_raid = true;
    raid_program_data.active_raid_id = raid_card_account.key.clone();
    raid_program_data
        .raids
        .push_str(&raid_card_account.key.to_string());
    raid_program_data.raids.push(',');

    let mut data = raid_program_account.data.borrow_mut();
    let bytes_written = raid_program_data.custom_serialize(&mut data)?;

    // Handle potential size changes
    if bytes_written > raid_prog_bytes_read {
        msg!(
            "New RaidProgramCard data is larger. Using {} bytes of empty space.",
            bytes_written - raid_prog_bytes_read
        );
    } else if bytes_written < raid_prog_bytes_read {
        msg!(
            "New RaidProgramCard data is smaller. Clearing {} bytes of unused space.",
            raid_prog_bytes_read - bytes_written
        );
        data[bytes_written..raid_prog_bytes_read].fill(0);
    }

    // Update ProgramRaidsStateCard
    let (mut program_raids_state, raids_state_bytes_read) =
        ProgramRaidsStateCard::custom_deserialize(&program_raids_state_account.data.borrow())?;
    program_raids_state
        .raid_pubkeys
        .push_str(&raid_card_account.key.to_string());
    program_raids_state.raid_pubkeys.push(',');

    let mut data = program_raids_state_account.data.borrow_mut();
    let bytes_written = program_raids_state.custom_serialize(&mut data)?;

    // Handle potential size changes
    if bytes_written > raids_state_bytes_read {
        msg!(
            "New ProgramRaidsStateCard data is larger. Using {} bytes of empty space.",
            bytes_written - raids_state_bytes_read
        );
    } else if bytes_written < raids_state_bytes_read {
        msg!(
            "New ProgramRaidsStateCard data is smaller. Clearing {} bytes of unused space.",
            raids_state_bytes_read - bytes_written
        );
        data[bytes_written..raids_state_bytes_read].fill(0);
    }

    msg!("Raid created and competition updated successfully");
    Ok(())
}

fn create_new_competition<'a>(
    program_id: &Pubkey,
    accounts: &[AccountInfo<'a>],
    sequence: u64,
    competition_type: &str,
    challenger_program_id: Option<Pubkey>,
    challenged_program_id: Option<Pubkey>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;
    let new_competition_account = next_account_info(account_info_iter)?;
    let program_competitions_state_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for new competition account
    let new_competition_seed = if competition_type == "PvP" {
        format!(
            "{}_{}_{}_{}",
            challenger_program_id
                .expect("Challenger program ID must be present for PvP competitions")
                .to_string(),
            competition_type,
            sequence,
            challenged_program_id
                .expect("Challenged program ID must be present for PvP competitions")
                .to_string(),
        )
    } else {
        format!("{}_{}", competition_type, sequence)
    };

    let mut hasher = Sha256::new();
    hasher.update(new_competition_seed.as_bytes());
    let result = hasher.finalize();
    let hashed_seed = &result[..32];

    let (new_competition_account_pda, bump) =
        Pubkey::find_program_address(&[hashed_seed], program_id);

    // Verify that the provided account matches the derived PDA
    if new_competition_account.key != &new_competition_account_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the new competition account already exists
    if !new_competition_account.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Create new competition account
    let new_competition_space = CompetitionCard {
        competition_id: new_competition_account.key.clone(),
        competition_type: competition_type.to_string(),
        start_time: 0,
        end_time: 0,
        total_rewards_distributed: 0,
        status: "awaiting".to_string(),
        enrolled_programs: String::new(),
        required_programs: match competition_type {
            "4-program" => 4,
            "6-program" => 6,
            "12-program" => 12,
            "24-program" => 24,
            "PvP" => 2,
            _ => return Err(ProgramError::InvalidArgument),
        },
        challenger_program_id,
        challenged_program_id,
        start_expiration: if competition_type == "PvP" {
            Some(Clock::get()?.unix_timestamp as u64 + 300) // 5 minutes from now
        } else {
            None
        },
        distributed_rewards: String::new(),
        placements: String::new(),
    };

    let space = 1000;

    let rent = Rent::get()?;

    if new_competition_account.data_is_empty() {
        create_pda_account(
            user_account,
            &rent,
            space,
            program_id,
            system_program,
            new_competition_account,
            &[hashed_seed, &[bump]],
        )?;
    }

    /*
        msg!("Initializing account...");
        invoke_signed(
            &token_instruction::initialize_account3(
                token_program.key,
                new_competition_account.key,
                token_mint_account.key,
                &new_competition_account_pda,
            )?,
            &[
                new_competition_account.clone(),
                token_mint_account.clone(),
                new_competition_account.clone(),
                rent.clone(),
            ],
            &[&[new_competition_seed.as_bytes(), &[bump]]],
        )?;
    */

    // Serialize new competition data
    new_competition_space.serialize(&mut &mut new_competition_account.data.borrow_mut()[..])?;

    // Update ProgramCompetitionsStateCard
    let mut program_competitions_state = ProgramCompetitionsStateCard::try_from_slice(
        &program_competitions_state_account.data.borrow(),
    )?;
    program_competitions_state
        .competition_pubkeys
        .push_str(&new_competition_account.key.to_string());
    program_competitions_state.competition_pubkeys.push(',');
    program_competitions_state
        .serialize(&mut &mut program_competitions_state_account.data.borrow_mut()[..])?;

    msg!("New competition created successfully");
    Ok(())
}

fn accept_pvp_challenge(accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let competition_account = next_account_info(account_info_iter)?;
    let challenged_program_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify program ownership
    let challenged_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&challenged_program_account.data.borrow())?;
    if challenged_program_data.user_key != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Deserialize competition data
    let mut competition_data: CompetitionCard =
        CompetitionCard::try_from_slice(&competition_account.data.borrow())?;

    // Verify competition is awaiting acceptance
    if competition_data.status != "awaiting" {
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the challenge has expired
    let current_time = Clock::get()?.unix_timestamp as u64;
    if current_time > competition_data.start_expiration.unwrap_or(0) {
        competition_data.status = "expired".to_string();
        competition_data.serialize(&mut &mut competition_account.data.borrow_mut()[..])?;
        return Err(ProgramError::InvalidAccountData);
    }

    // Update competition data
    competition_data.challenged_program_id = Some(challenged_program_data.raid_program_id.clone());
    competition_data.status = "active".to_string();
    competition_data.start_time = Clock::get()?.unix_timestamp as u64 + 300;
    competition_data.end_time = competition_data.start_time + 1200; // End in 20 minutes

    competition_data.serialize(&mut &mut competition_account.data.borrow_mut()[..])?;

    // Update challenged program data to indicate it is conducting a raid
    let mut challenged_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&challenged_program_account.data.borrow())?;
    challenged_program_data.is_conducting_raid = true;
    challenged_program_data
        .serialize(&mut &mut challenged_program_account.data.borrow_mut()[..])?;

    msg!("PvP challenge accepted and competition started successfully");
    Ok(())
}

fn check_raid_status(//accounts: &[AccountInfo],
    //raid_program_id: u64,
) -> ProgramResult {
    //let account_info_iter = &mut accounts.iter();
    //let raid_account = next_account_info(account_info_iter)?;

    // Deserialize raid data
    //let raid_data: RaidCard = RaidCard::try_from_slice(&raid_account.data.borrow())?;

    // Check if the raid has ended
    //let current_time = Clock::get()?.unix_timestamp as u64;

    msg!("Raid status checked successfully");
    Ok(())
}

fn create_user_card(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_card_account = next_account_info(account_info_iter)?;
    let program_state_account = next_account_info(account_info_iter)?;
    let system_program = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for user card account
    let user_card_seed = format!("user_card_{}", user_account.key.to_string());
    let mut hasher = Sha256::new();
    hasher.update(user_card_seed.as_bytes());
    let result = hasher.finalize();
    let seed = &result[..32];

    let (user_card_account_pda, bump) = Pubkey::find_program_address(&[seed], program_id);

    // Verify provided user card account matches derived PDA
    if user_card_account.key != &user_card_account_pda {
        msg!("Error: User card account does not match derived PDA");
        return Err(ProgramError::InvalidAccountData);
    }

    // Check if the account already exists
    if !user_card_account.data_is_empty() {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    // Verify program state account
    let (program_state_pda, _) = Pubkey::find_program_address(&[b"program_state"], program_id);
    if program_state_account.key != &program_state_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create UserCard data
    let user_card_data = UserCard {
        user_pubkey: *user_account.key,
        owned_programs: String::new(),
        enrolled_programs: String::new(),
        is_conducting_raid: false,
        user_email: String::new(),
        user_dob: String::new(),
        user_twitter_handle: String::new(),
        total_rewards: 0,
        participated_raids: 0,
        raid_ranking: 0,
        engagement_score: 0,
        streaks: 0,
        profile_picture_url: String::new(),
    };

    let space = 1000;

    // Create PDA account
    create_pda_account(
        user_account,
        &Rent::get()?,
        space,
        program_id,
        system_program,
        user_card_account,
        &[&seed, &[bump]],
    )?;

    // Serialize and save UserCard data
    user_card_data.serialize(&mut &mut user_card_account.data.borrow_mut()[..])?;

    // Deserialize ProgramStateCard from account data using custom_deserialize
    let (mut program_state, bytes_read) = ProgramStateCard::custom_deserialize(
        &program_state_account.data.borrow(),
    )
    .map_err(|e| {
        msg!("Failed to deserialize ProgramStateCard: {:?}", e);
        ProgramError::InvalidAccountData
    })?;

    msg!("Bytes read during deserialization: {}", bytes_read);
    let total_space = program_state_account.data.borrow().len();
    let initial_unused_space = total_space - bytes_read;
    msg!("Initial unused space: {} bytes", initial_unused_space);

    // Modify the program state
    msg!("Current ProgramStateCard: {:?}", program_state);
    program_state.registered_users_count += 1;
    msg!("Updated ProgramStateCard: {:?}", program_state);

    // Use custom serialization
    let mut data = program_state_account.data.borrow_mut();
    let bytes_written = program_state.custom_serialize(&mut data).map_err(|e| {
        msg!("Failed to serialize updated ProgramStateCard: {:?}", e);
        ProgramError::AccountDataTooSmall
    })?;

    msg!("Bytes written during serialization: {}", bytes_written);

    if bytes_written > total_space {
        msg!(
            "Error: New data size ({} bytes) exceeds total account space ({} bytes)",
            bytes_written,
            total_space
        );
        return Err(ProgramError::AccountDataTooSmall);
    }

    // Handle both scenarios: new data smaller or larger than old data
    if bytes_written < bytes_read {
        // New data is smaller: clear unused space
        msg!("New data is smaller. Clearing unused space.");
        data[bytes_written..bytes_read].fill(0);
        let new_unused_space = total_space - bytes_written;
        msg!("New unused space: {} bytes", new_unused_space);
        msg!(
            "Additional unused space created: {} bytes",
            bytes_read - bytes_written
        );
    } else if bytes_written > bytes_read {
        // New data is larger: using some of the empty space
        msg!("New data is larger. Using some empty space.");
        let space_used = bytes_written - bytes_read;
        msg!(
            "Additional space used from empty space: {} bytes",
            space_used
        );
        let new_unused_space = total_space - bytes_written;
        msg!("Remaining unused space: {} bytes", new_unused_space);
    } else {
        // Data size unchanged
        msg!("Data size unchanged.");
    }

    msg!("Successfully updated ProgramStateCard");
    msg!("User card created successfully");
    Ok(())
}

fn enroll_in_program(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_card_account = next_account_info(account_info_iter)?;
    let raid_program_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Deserialize UserCard
    let mut user_card_data: UserCard = UserCard::try_from_slice(&user_card_account.data.borrow())?;

    // Verify that the user_card belongs to the signer
    if user_card_data.user_pubkey != *user_account.key {
        return Err(ProgramError::InvalidAccountData);
    }

    // Get the raid program public key
    let raid_program_data: RaidProgramCard =
        RaidProgramCard::try_from_slice(&raid_program_account.data.borrow())?;
    let raid_program_pubkey = raid_program_data.raid_program_id.to_string();

    // Check if the user is already enrolled
    if user_card_data
        .enrolled_programs
        .contains(&raid_program_pubkey)
    {
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    user_card_data
        .enrolled_programs
        .push_str(&raid_program_pubkey);
    user_card_data.enrolled_programs.push(',');

    // Serialize and save the updated UserCard
    user_card_data.serialize(&mut &mut user_card_account.data.borrow_mut()[..])?;

    msg!("User enrolled in program successfully");
    Ok(())
}

pub fn update_user_card(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    user_email: String,
    user_twitter_handle: String,
    user_dob: String,
    profile_picture_url: String,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let user_account = next_account_info(account_info_iter)?;
    let user_card_account = next_account_info(account_info_iter)?;

    // Verify user is signer
    if !user_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify the user card account
    let (user_card_pda, _) =
        Pubkey::find_program_address(&[b"user_card", user_account.key.as_ref()], program_id);
    if user_card_account.key != &user_card_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Update user card data
    let mut user_card_data = UserCard::try_from_slice(&user_card_account.data.borrow())?;
    user_card_data.user_email = user_email;
    user_card_data.user_twitter_handle = user_twitter_handle;
    user_card_data.user_dob = user_dob;
    user_card_data.profile_picture_url = profile_picture_url;

    user_card_data.serialize(&mut &mut user_card_account.data.borrow_mut()[..])?;

    Ok(())
}

fn authority_mint(program_id: &Pubkey, accounts: &[AccountInfo], amount: u64) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let authority_account = next_account_info(account_info_iter)?;
    let token_mint = next_account_info(account_info_iter)?;
    let recipient_token_account = next_account_info(account_info_iter)?;
    let token_program = next_account_info(account_info_iter)?;

    // Verify the authority
    if authority_account.key != &AUTHORITY_PUBKEY {
        return Err(ProgramError::InvalidAccountData);
    }

    // Ensure the authority is a signer
    if !authority_account.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Derive PDA for token mint
    let (token_mint_pda, mint_bump) =
        Pubkey::find_program_address(&[b"pda_token_mint"], program_id);

    // Verify the token mint
    if token_mint.key != &token_mint_pda {
        return Err(ProgramError::InvalidAccountData);
    }

    // Mint tokens to recipient's ATA
    invoke_signed(
        &token_instruction::mint_to(
            token_program.key,
            token_mint.key,
            recipient_token_account.key,
            &token_mint_pda,
            &[],
            amount,
        )?,
        &[
            token_mint.clone(),
            recipient_token_account.clone(),
            token_program.clone(),
        ],
        &[&[b"pda_token_mint", &[mint_bump]]],
    )?;

    msg!("Minted {} tokens to recipient", amount);
    Ok(())
}
